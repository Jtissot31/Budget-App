package expo.modules.samsungliquidglass

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Outline
import android.view.View
import android.view.ViewOutlineProvider
import android.view.ViewTreeObserver
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

@SuppressLint("ViewConstructor")
class SamsungLiquidGlassView(context: Context, appContext: AppContext) : ExpoView(context, appContext),
  ViewTreeObserver.OnPreDrawListener {
  private var blurRadius: Int = 80
  private var overlayColor: Int = Color.argb(90, 12, 12, 14)
  private var cornerRadiusPx: Float = 999f
  internal var blurEnabled: Boolean = true
    private set

  /** Live nav (~180ms via coordinator). FABs use a slower cadence to cut thrash. */
  private var minRefreshMs: Long = 180L

  private var lastBitmap: Bitmap? = null
  private var lastAppliedAt: Long = 0L
  private var captureRequested: Boolean = false

  /** Skip redundant OnViewDidUpdateProps → capture storms from RN re-renders. */
  private var lastAppliedRadius: Int = -1
  private var lastAppliedOverlay: Int = Int.MIN_VALUE
  private var lastAppliedCorner: Float = -1f
  private var lastAppliedEnabled: Boolean? = null
  private var lastAppliedRefreshMs: Long = -1L
  private var propsDirty: Boolean = true

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
    val next = ms.toLong().coerceIn(80L, 5_000L)
    if (next != minRefreshMs) {
      minRefreshMs = next
      propsDirty = true
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
    lastAppliedAt = System.currentTimeMillis()
    lastAppliedRadius = blurRadius
    lastAppliedOverlay = overlayColor
    lastAppliedCorner = cornerRadiusPx
    lastAppliedEnabled = blurEnabled
    lastAppliedRefreshMs = minRefreshMs
    propsDirty = false
  }

  /** Called from module OnViewDidUpdateProps — only re-capture when props actually changed. */
  fun onPropsUpdated() {
    if (!propsDirty &&
      blurRadius == lastAppliedRadius &&
      overlayColor == lastAppliedOverlay &&
      cornerRadiusPx == lastAppliedCorner &&
      blurEnabled == lastAppliedEnabled &&
      minRefreshMs == lastAppliedRefreshMs
    ) {
      return
    }
    propsDirty = false
    scheduleApplyBlur(force = true)
  }

  fun scheduleApplyBlur(force: Boolean = false) {
    post {
      if (isAttachedToWindow) {
        BlurCaptureCoordinator.requestCapture(this, force = force)
      }
    }
  }

  internal fun captureOverlay(): View = (parent as? View) ?: this

  internal fun hostActivity(): Activity? = appContext.currentActivity

  internal fun lastBitmapOrNull(): Bitmap? = lastBitmap

  internal fun markCaptureRequested() {
    captureRequested = true
  }

  internal fun clearCaptureRequest() {
    captureRequested = false
  }

  internal fun hasCaptureRequest(): Boolean = captureRequested

  internal fun shouldRefresh(now: Long): Boolean {
    if (!blurEnabled) return false
    if (lastBitmap == null) return true
    return now - lastAppliedAt >= minRefreshMs
  }

  internal fun consumeCapturedBitmap(bitmap: Bitmap) {
    lastBitmap?.recycle()
    lastBitmap = bitmap
    applyBlur(bitmap)
  }

  override fun onPreDraw(): Boolean {
    if (!isAttachedToWindow || !blurEnabled) return true
    val now = System.currentTimeMillis()
    if (now - lastAppliedAt < minRefreshMs) return true
    BlurCaptureCoordinator.requestCapture(this, force = false)
    return true
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
    scheduleApplyBlur(force = true)
  }

  override fun onDetachedFromWindow() {
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
