package expo.modules.samsungliquidglass

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Choreographer
import android.view.View
import java.lang.ref.WeakReference
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Global SemBlur capture pipeline for all [SamsungLiquidGlassView] instances.
 *
 * Snapshot is synchronous (hide → [View.draw] → restore on one call stack) so the
 * display never presents blank chrome. Live views are driven by vsync kicks + a
 * heartbeat watchdog (not idle-debounce) so Moti / scroll cannot stall refreshes.
 *
 * Performance: capture only the union of due overlay bounds (nav strip), downsampled,
 * instead of a full-screen ARGB bitmap every wave.
 */
internal object BlurCaptureCoordinator {
  private const val TAG = "SemBlurCapture"

  private val mainHandler = Handler(Looper.getMainLooper())
  private val registry = CopyOnWriteArrayList<WeakReference<SamsungLiquidGlassView>>()

  @Volatile private var capturing = false
  @Volatile private var pending = false
  @Volatile private var paused = false
  private var lastWaveAt = 0L
  private var waveGeneration = 0
  private var activeOverlays: Map<View, Int>? = null
  /** Back-to-back pending waves → lower capture scale for fluidity. */
  private var backlogPressure = 0
  private var drainFramePosted = false
  private var delayedDrainPosted = false

  /** Floor between coordinated waves (~30 fps; region capture keeps this cheap). */
  private const val MIN_WAVE_MS = 32L
  /** If a wave hangs (decor.draw / OOM path), force-restore and resume. */
  private const val WATCHDOG_MS = 280L
  /** Never stay paused indefinitely (missed scroll-end / RN transition). */
  private const val PAUSE_AUTO_RESUME_MS = 1_200L
  /** Soft pad around overlay bounds so blur edges don't sample clipped content. */
  private const val REGION_PAD_PX = 12
  private const val SCALE_NORMAL = 0.45f
  private const val SCALE_BUSY = 0.36f
  private const val SCALE_HEAVY = 0.28f


  private val autoResumePause =
    Runnable {
      if (paused) {
        setPaused(false)
      }
    }

  private val watchdog =
    Runnable {
      if (!capturing) return@Runnable
      Log.w(TAG, "watchdog fired — restoring overlays")
      val overlays = activeOverlays
      if (overlays != null) {
        restore(overlays)
        activeOverlays = null
      }
      capturing = false
      pending = true
      scheduleDrain(MIN_WAVE_MS)
    }

  private val drainFrameCallback =
    Choreographer.FrameCallback {
      drainFramePosted = false
      drain()
    }

  private val delayedDrainRunnable =
    Runnable {
      delayedDrainPosted = false
      scheduleDrain(0L)
    }

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

  /** Pause live captures briefly (e.g. scroll). Auto-resumes so blur cannot stick frozen. */
  fun setPaused(value: Boolean) {
    mainHandler.removeCallbacks(autoResumePause)
    paused = value
    if (value) {
      mainHandler.postDelayed(autoResumePause, PAUSE_AUTO_RESUME_MS)
    } else {
      pending = true
      scheduleDrain(0L)
    }
  }

  fun isPaused(): Boolean = paused

  fun requestCapture(view: SamsungLiquidGlassView, force: Boolean = false) {
    if (!view.isAttachedToWindow || !view.blurEnabled) return
    register(view)
    view.markCaptureRequested()

    if (paused && !force) {
      pending = true
      return
    }

    if (capturing) {
      pending = true
      backlogPressure = (backlogPressure + 1).coerceAtMost(4)
      return
    }

    val now = SystemClock.uptimeMillis()
    if (!force && now - lastWaveAt < MIN_WAVE_MS) {
      pending = true
      val delay = (MIN_WAVE_MS - (now - lastWaveAt)).coerceAtLeast(1L)
      scheduleDrain(delay)
      return
    }

    scheduleDrain(0L)
  }

  private fun scheduleDrain(delayMs: Long) {
    if (delayMs <= 0L) {
      mainHandler.removeCallbacks(delayedDrainRunnable)
      delayedDrainPosted = false
      if (drainFramePosted) return
      drainFramePosted = true
      Choreographer.getInstance().postFrameCallback(drainFrameCallback)
      return
    }
    if (drainFramePosted || delayedDrainPosted) return
    delayedDrainPosted = true
    mainHandler.postDelayed(delayedDrainRunnable, delayMs)
  }

  private fun drain() {
    if (paused) {
      pending = true
      return
    }
    if (capturing) {
      pending = true
      return
    }
    if (!pending && registry.none { it.get()?.hasCaptureRequest() == true }) return
    startWave(force = false)
  }

  private fun startWave(force: Boolean) {
    prune()
    val attached =
      registry.mapNotNull { it.get() }.filter { it.isAttachedToWindow && it.blurEnabled }
    if (attached.isEmpty()) {
      pending = false
      backlogPressure = 0
      return
    }

    // Only views that asked — never pull frozen FABs into a nav wave.
    val due =
      attached.filter { view ->
        view.hasCaptureRequest() &&
          (force || view.allowsLiveCapture() || view.lastBitmapOrNull() == null)
      }
    if (due.isEmpty()) {
      for (v in attached) {
        if (v.hasCaptureRequest() && !v.allowsLiveCapture() && v.lastBitmapOrNull() != null) {
          v.clearCaptureRequest()
        }
      }
      pending = false
      return
    }

    capturing = true
    pending = false
    lastWaveAt = SystemClock.uptimeMillis()
    val waveId = ++waveGeneration
    val scale = captureScale()
    val t0 = lastWaveAt

    val overlays = LinkedHashMap<View, Int>()
    for (v in due) {
      val overlay = v.captureOverlay()
      if (!overlays.containsKey(overlay)) {
        overlays[overlay] = overlay.visibility
        // INVISIBLE (not GONE) keeps layout; same-stack restore avoids committed blank frames.
        overlay.visibility = View.INVISIBLE
      }
    }
    activeOverlays = overlays

    mainHandler.removeCallbacks(watchdog)
    mainHandler.postDelayed(watchdog, WATCHDOG_MS)

    try {
      val activity = due.firstOrNull()?.hostActivity()
      val decor = activity?.window?.decorView
      if (decor == null || decor.width <= 0 || decor.height <= 0) {
        for (v in due) {
          v.clearCaptureRequest()
          v.applyBlur(v.lastBitmapOrNull())
          v.noteCaptureAttempt(success = false)
        }
        return
      }

      val region = unionBounds(due, decor) ?: run {
        for (v in due) {
          v.clearCaptureRequest()
          v.applyBlur(v.lastBitmapOrNull())
          v.noteCaptureAttempt(success = false)
        }
        return
      }

      val snapshot = snapshotRegion(decor, region, scale)
      val tDraw = SystemClock.uptimeMillis()
      if (snapshot == null) {
        for (v in due) {
          v.clearCaptureRequest()
          v.applyBlur(v.lastBitmapOrNull())
          v.noteCaptureAttempt(success = false)
        }
        return
      }

      val bmpW = snapshot.width
      val bmpH = snapshot.height
      try {
        val loc = IntArray(2)
        for (v in due) {
          v.clearCaptureRequest()
          val w = v.width
          val h = v.height
          if (w <= 0 || h <= 0) {
            v.applyBlur(v.lastBitmapOrNull())
            v.noteCaptureAttempt(success = false)
            continue
          }
          v.getLocationInWindow(loc)
          val x = ((loc[0] - region.left) * scale).toInt().coerceIn(0, bmpW)
          val y = ((loc[1] - region.top) * scale).toInt().coerceIn(0, bmpH)
          val cw = (w * scale).toInt().coerceAtMost(bmpW - x).coerceAtLeast(0)
          val ch = (h * scale).toInt().coerceAtMost(bmpH - y).coerceAtLeast(0)
          if (cw <= 0 || ch <= 0) {
            v.applyBlur(v.lastBitmapOrNull())
            v.noteCaptureAttempt(success = false)
            continue
          }
          val cropped =
            try {
              Bitmap.createBitmap(snapshot, x, y, cw, ch)
            } catch (_: Throwable) {
              null
            }
          if (cropped != null) {
            v.consumeCapturedBitmap(cropped)
            v.noteCaptureAttempt(success = true)
          } else {
            v.applyBlur(v.lastBitmapOrNull())
            v.noteCaptureAttempt(success = false)
          }
        }
      } finally {
        if (!snapshot.isRecycled) snapshot.recycle()
      }

      val total = SystemClock.uptimeMillis() - t0
      if (Log.isLoggable(TAG, Log.DEBUG)) {
        Log.d(
          TAG,
          "wave ok region=${region.width()}x${region.height()} scale=$scale " +
            "bmp=${bmpW}x${bmpH} drawMs=${tDraw - t0} totalMs=$total " +
            "views=${due.size} pressure=$backlogPressure",
        )
      }
    } catch (_: Throwable) {
      for (v in due) {
        v.clearCaptureRequest()
        try {
          v.applyBlur(v.lastBitmapOrNull())
        } catch (_: Throwable) {
          // keep going
        }
        v.noteCaptureAttempt(success = false)
      }
    } finally {
      if (waveGeneration == waveId) {
        mainHandler.removeCallbacks(watchdog)
        restore(overlays)
        activeOverlays = null
        finishWave()
      }
    }
  }

  private fun captureScale(): Float =
    when {
      backlogPressure >= 2 -> SCALE_HEAVY
      backlogPressure >= 1 -> SCALE_BUSY
      else -> SCALE_NORMAL
    }

  private fun unionBounds(views: List<SamsungLiquidGlassView>, decor: View): Rect? {
    var minX = Int.MAX_VALUE
    var minY = Int.MAX_VALUE
    var maxX = Int.MIN_VALUE
    var maxY = Int.MIN_VALUE
    val loc = IntArray(2)
    for (v in views) {
      if (v.width <= 0 || v.height <= 0) continue
      v.getLocationInWindow(loc)
      minX = minOf(minX, loc[0])
      minY = minOf(minY, loc[1])
      maxX = maxOf(maxX, loc[0] + v.width)
      maxY = maxOf(maxY, loc[1] + v.height)
    }
    if (minX >= maxX || minY >= maxY) return null
    val pad = REGION_PAD_PX
    return Rect(
      (minX - pad).coerceAtLeast(0),
      (minY - pad).coerceAtLeast(0),
      (maxX + pad).coerceAtMost(decor.width),
      (maxY + pad).coerceAtMost(decor.height),
    )
  }

  /**
   * Draw only [region] of [decor] into a downsampled bitmap. Canvas clip + translate
   * avoids allocating a full-screen buffer (main lag source on S25 Ultra).
   */
  private fun snapshotRegion(decor: View, region: Rect, scale: Float): Bitmap? {
    val outW = (region.width() * scale).toInt().coerceAtLeast(1)
    val outH = (region.height() * scale).toInt().coerceAtLeast(1)
    return try {
      val bitmap = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      canvas.scale(scale, scale)
      canvas.translate(-region.left.toFloat(), -region.top.toFloat())
      canvas.clipRect(region)
      decor.draw(canvas)
      bitmap
    } catch (_: Throwable) {
      null
    }
  }

  private fun restore(overlays: Map<View, Int>) {
    for ((overlay, visibility) in overlays) {
      try {
        overlay.visibility = visibility
      } catch (_: Throwable) {
        // view may be detached mid-wave
      }
    }
  }

  private fun finishWave() {
    capturing = false
    if (paused) {
      pending = true
      return
    }
    val hasMore = pending || registry.any { it.get()?.hasCaptureRequest() == true }
    if (hasMore) {
      pending = true
      backlogPressure = (backlogPressure + 1).coerceAtMost(4)
      scheduleDrain(MIN_WAVE_MS)
    } else {
      backlogPressure = 0
    }
  }

  private fun prune() {
    registry.removeAll { it.get() == null }
  }
}
