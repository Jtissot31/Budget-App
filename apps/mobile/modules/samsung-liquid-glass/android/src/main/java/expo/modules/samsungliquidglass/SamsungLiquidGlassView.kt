package expo.modules.samsungliquidglass

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Outline
import android.os.SystemClock
import android.view.Choreographer
import android.view.View
import android.view.ViewOutlineProvider
import android.view.ViewTreeObserver
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

@SuppressLint("ViewConstructor")
class SamsungLiquidGlassView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext), ViewTreeObserver.OnPreDrawListener {
  private var blurRadius: Int = 80
  private var overlayColor: Int = Color.argb(90, 12, 12, 14)
  private var cornerRadiusPx: Float = 999f
  internal var blurEnabled: Boolean = true
    private set

  /** Min gap between live samples (nav/FAB ~48ms). Coordinator floors waves separately. */
  private var minRefreshMs: Long = 48L

  /**
   * When false, capture once (attach/layout) then keep that SemBlur frame.
   * When true, a continuous Choreographer loop samples even when this view is not
   * invalidated (scroll/Moti of content behind a fixed overlay).
   */
  private var liveCapture: Boolean = true

  private var lastBitmap: Bitmap? = null
  private var lastAppliedAt: Long = 0L
  private var captureRequested: Boolean = false
  private var contentDirty: Boolean = true
  private var consecutiveFailures: Int = 0
  private var liveLoopPosted: Boolean = false

  /** Skip redundant OnViewDidUpdateProps → capture storms from RN re-renders. */
  private var lastAppliedRadius: Int = -1
  private var lastAppliedOverlay: Int = Int.MIN_VALUE
  private var lastAppliedCorner: Float = -1f
  private var lastAppliedEnabled: Boolean? = null
  private var lastAppliedRefreshMs: Long = -1L
  private var lastAppliedLive: Boolean? = null
  private var propsDirty: Boolean = true

  private val choreographer = Choreographer.getInstance()

  /**
   * Continuous live sampler. PreDraw alone is insufficient: scrolling content behind
   * a fixed glass overlay does not invalidate this view, so PreDraw never fires and
   * a slow heartbeat felt like ~0.5s lag. This loop keeps sampling at [minRefreshMs].
   */
  private val liveLoop =
    object : Choreographer.FrameCallback {
      override fun doFrame(frameTimeNanos: Long) {
        liveLoopPosted = false
        if (!isAttachedToWindow || !blurEnabled || !liveCapture) return

        if (!BlurCaptureCoordinator.isPaused()) {
          val now = SystemClock.uptimeMillis()
          val due =
            lastBitmap == null ||
              consecutiveFailures > 0 ||
              now - lastAppliedAt >= minRefreshMs
          if (due) {
            // Content behind may have moved without dirtying this view.
            contentDirty = true
            BlurCaptureCoordinator.requestCapture(this@SamsungLiquidGlassView, force = false)
          }
        }

        scheduleLiveLoop()
      }
    }

  init {
    setWillNotDraw(false)
    setBackgroundColor(Color.TRANSPARENT)
    clipToOutline = true
    outlineProvider =
      object : ViewOutlineProvider() {
        override fun getOutline(view: View, outline: Outline) {
          val radius = resolvedCornerRadius(view)
          outline.setRoundRect(0, 0, view.width, view.height, radius)
        }
      }
  }

  fun setBlurRadius(radius: Int) {
    val next = radius.coerceIn(0, 200)
    if (next != blurRadius) {
      blurRadius = next
      propsDirty = true
    }
  }

  fun setOverlayColor(color: String?) {
    if (color.isNullOrBlank()) return
    val next =
      try {
        Color.parseColor(color)
      } catch (_: Throwable) {
        return
      }
    if (next != overlayColor) {
      overlayColor = next
      propsDirty = true
    }
  }

  fun setCornerRadius(radius: Float) {
    val next = radius.coerceAtLeast(0f)
    if (next != cornerRadiusPx) {
      cornerRadiusPx = next
      propsDirty = true
      invalidateOutline()
    }
  }

  fun setBlurEnabled(enabled: Boolean) {
    if (enabled != blurEnabled) {
      blurEnabled = enabled
      propsDirty = true
    }
  }

  fun setMinRefreshMs(ms: Int) {
    val next = ms.toLong().coerceIn(32L, 5_000L)
    if (next != minRefreshMs) {
      minRefreshMs = next
      propsDirty = true
    }
  }

  fun setLiveCapture(live: Boolean) {
    if (live != liveCapture) {
      liveCapture = live
      propsDirty = true
      if (live && isAttachedToWindow) {
        scheduleLiveLoop()
      } else if (!live) {
        cancelLiveLoop()
      }
    }
  }

  fun applyBlur(captured: Bitmap? = lastBitmap) {
    if (width <= 0 || height <= 0) return

    if (!blurEnabled || blurRadius <= 0) {
      SamsungSemBlur.clear(this)
      setBackgroundColor(overlayColor)
      return
    }

    elevation = 0f
    translationZ = 0f

    val ok =
      SamsungSemBlur.apply(this, blurRadius, overlayColor, resolvedCornerRadius(this), captured)
    if (!ok) {
      setBackgroundColor(overlayColor)
    }
    lastAppliedAt = SystemClock.uptimeMillis()
    lastAppliedRadius = blurRadius
    lastAppliedOverlay = overlayColor
    lastAppliedCorner = cornerRadiusPx
    lastAppliedEnabled = blurEnabled
    lastAppliedRefreshMs = minRefreshMs
    lastAppliedLive = liveCapture
    propsDirty = false
  }

  /** Called from module OnViewDidUpdateProps — only re-capture when props actually changed. */
  fun onPropsUpdated() {
    if (!propsDirty &&
      blurRadius == lastAppliedRadius &&
      overlayColor == lastAppliedOverlay &&
      cornerRadiusPx == lastAppliedCorner &&
      blurEnabled == lastAppliedEnabled &&
      minRefreshMs == lastAppliedRefreshMs &&
      liveCapture == lastAppliedLive
    ) {
      return
    }
    propsDirty = false
    if (!liveCapture && lastBitmap != null) {
      applyBlur(lastBitmap)
      return
    }
    contentDirty = true
    scheduleApplyBlur(force = true)
  }

  fun scheduleApplyBlur(force: Boolean = false) {
    post {
      if (isAttachedToWindow) {
        contentDirty = true
        BlurCaptureCoordinator.requestCapture(this, force = force)
      }
    }
  }

  internal fun captureOverlay(): View = (parent as? View) ?: this

  internal fun hostActivity(): Activity? = appContext.currentActivity

  internal fun lastBitmapOrNull(): Bitmap? = lastBitmap

  internal fun allowsLiveCapture(): Boolean = liveCapture

  internal fun markCaptureRequested() {
    captureRequested = true
  }

  internal fun clearCaptureRequest() {
    captureRequested = false
  }

  internal fun hasCaptureRequest(): Boolean = captureRequested

  internal fun consumeCapturedBitmap(bitmap: Bitmap) {
    lastBitmap?.recycle()
    lastBitmap = bitmap
    contentDirty = false
    applyBlur(bitmap)
  }

  internal fun noteCaptureAttempt(success: Boolean) {
    if (success) {
      consecutiveFailures = 0
    } else {
      consecutiveFailures = (consecutiveFailures + 1).coerceAtMost(8)
      contentDirty = true
    }
  }

  /**
   * Marks content dirty when this view itself redraws. Primary live path is [liveLoop]
   * (scroll behind fixed chrome does not trigger PreDraw here).
   */
  override fun onPreDraw(): Boolean {
    if (!isAttachedToWindow || !blurEnabled || !liveCapture) return true
    contentDirty = true
    return true
  }

  private fun scheduleLiveLoop() {
    if (!liveCapture || !isAttachedToWindow || !blurEnabled) return
    if (liveLoopPosted) return
    liveLoopPosted = true
    // Delay by refresh window so we do not request every vsync (~16ms) and thrash.
    choreographer.postFrameCallbackDelayed(liveLoop, minRefreshMs)
  }

  private fun cancelLiveLoop() {
    if (!liveLoopPosted) return
    choreographer.removeFrameCallback(liveLoop)
    liveLoopPosted = false
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    if (changed) {
      invalidateOutline()
      scheduleApplyBlur(force = true)
    }
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    invalidateOutline()
    if (w > 0 && h > 0 && (w != oldw || h != oldh)) {
      scheduleApplyBlur(force = true)
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    BlurCaptureCoordinator.register(this)
    viewTreeObserver.addOnPreDrawListener(this)
    contentDirty = true
    scheduleApplyBlur(force = true)
    scheduleLiveLoop()
  }

  override fun onDetachedFromWindow() {
    cancelLiveLoop()
    try {
      viewTreeObserver.removeOnPreDrawListener(this)
    } catch (_: Throwable) {
      // observer already dead
    }
    BlurCaptureCoordinator.unregister(this)
    SamsungSemBlur.clear(this)
    lastBitmap?.recycle()
    lastBitmap = null
    super.onDetachedFromWindow()
  }

  private fun resolvedCornerRadius(view: View): Float {
    val max = minOf(view.width, view.height) / 2f
    return if (max > 0f) minOf(cornerRadiusPx, max) else cornerRadiusPx
  }
}
