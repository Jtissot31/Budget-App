package expo.modules.samsungliquidglass

import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import android.view.PixelCopy
import android.view.View
import java.lang.ref.WeakReference
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger

/**
 * Serializes PixelCopy across all [SamsungLiquidGlassView] instances.
 *
 * Uncoordinated captures hide each overlay on staggered frames → flicker / tear,
 * and one glass view often lands inside another's bitmap (stacked blur).
 * One pass: hide every registered overlay → copy all rects → restore → apply.
 */
internal object BlurCaptureCoordinator {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val registry = CopyOnWriteArrayList<WeakReference<SamsungLiquidGlassView>>()

  @Volatile private var capturing = false
  @Volatile private var pending = false
  private var lastWaveAt = 0L
  private var waveGeneration = 0

  /** Minimum gap between coordinated capture waves (all views share this). */
  private const val MIN_WAVE_MS = 180L
  private const val CAPTURE_TIMEOUT_MS = 450L

  fun register(view: SamsungLiquidGlassView) {
    prune()
    if (registry.none { it.get() === view }) {
      registry.add(WeakReference(view))
    }
  }

  fun unregister(view: SamsungLiquidGlassView) {
    registry.removeAll { ref ->
      val v = ref.get()
      v == null || v === view
    }
  }

  fun requestCapture(view: SamsungLiquidGlassView, force: Boolean = false) {
    if (!view.isAttachedToWindow || !view.blurEnabled) return
    register(view)
    view.markCaptureRequested()

    if (capturing) {
      pending = true
      return
    }

    val now = System.currentTimeMillis()
    if (!force && now - lastWaveAt < MIN_WAVE_MS) {
      pending = true
      val delay = (MIN_WAVE_MS - (now - lastWaveAt)).coerceAtLeast(1L)
      mainHandler.postDelayed({ drain() }, delay)
      return
    }

    startWave()
  }

  private fun drain() {
    if (capturing) {
      pending = true
      return
    }
    if (!pending && registry.none { it.get()?.hasCaptureRequest() == true }) return
    startWave()
  }

  private fun startWave() {
    prune()
    val targets =
      registry.mapNotNull { it.get() }.filter { it.isAttachedToWindow && it.blurEnabled }
    if (targets.isEmpty()) {
      pending = false
      return
    }

    val now = System.currentTimeMillis()
    val due =
      targets.filter { view ->
        view.hasCaptureRequest() || view.shouldRefresh(now)
      }
    if (due.isEmpty()) {
      pending = false
      return
    }

    capturing = true
    pending = false
    lastWaveAt = now
    val waveId = ++waveGeneration

    val overlays = LinkedHashMap<View, Int>()
    for (v in targets) {
      val overlay = v.captureOverlay()
      if (!overlays.containsKey(overlay)) {
        overlays[overlay] = overlay.visibility
        overlay.visibility = View.INVISIBLE
      }
    }

    // Safety: never leave glass chrome stuck invisible if PixelCopy hangs.
    mainHandler.postDelayed(
      {
        if (capturing && waveGeneration == waveId) {
          restore(overlays)
          finishWave()
        }
      },
      CAPTURE_TIMEOUT_MS,
    )

    Choreographer.getInstance().postFrameCallback {
      if (waveGeneration != waveId) return@postFrameCallback

      val activity = due.firstOrNull()?.hostActivity()
      val window = activity?.window
      if (window == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        restore(overlays)
        for (v in due) {
          v.clearCaptureRequest()
          v.applyBlur(v.lastBitmapOrNull())
        }
        finishWave()
        return@postFrameCallback
      }

      val remaining = AtomicInteger(due.size)
      fun onOneDone() {
        if (remaining.decrementAndGet() == 0 && waveGeneration == waveId) {
          restore(overlays)
          finishWave()
        }
      }

      for (v in due) {
        v.clearCaptureRequest()
        val w = v.width
        val h = v.height
        if (w <= 0 || h <= 0) {
          onOneDone()
          continue
        }
        val loc = IntArray(2)
        v.getLocationInWindow(loc)
        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val src = Rect(loc[0], loc[1], loc[0] + w, loc[1] + h)
        try {
          PixelCopy.request(
            window,
            src,
            bitmap,
            { result ->
              if (waveGeneration != waveId) {
                bitmap.recycle()
                return@request
              }
              if (result == PixelCopy.SUCCESS) {
                v.consumeCapturedBitmap(bitmap)
              } else {
                bitmap.recycle()
                v.applyBlur(v.lastBitmapOrNull())
              }
              onOneDone()
            },
            mainHandler,
          )
        } catch (_: Throwable) {
          bitmap.recycle()
          v.applyBlur(v.lastBitmapOrNull())
          onOneDone()
        }
      }
    }
  }

  private fun restore(overlays: Map<View, Int>) {
    for ((overlay, visibility) in overlays) {
      overlay.visibility = visibility
    }
  }

  private fun finishWave() {
    capturing = false
    if (pending || registry.any { it.get()?.hasCaptureRequest() == true }) {
      pending = true
      mainHandler.postDelayed({ drain() }, MIN_WAVE_MS)
    }
  }

  private fun prune() {
    registry.removeAll { it.get() == null }
  }
}
