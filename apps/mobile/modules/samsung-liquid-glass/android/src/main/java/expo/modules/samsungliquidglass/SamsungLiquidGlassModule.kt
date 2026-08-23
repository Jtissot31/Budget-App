package expo.modules.samsungliquidglass

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SamsungLiquidGlassModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SamsungLiquidGlass")

    OnCreate {
      SamsungSemBlur.ensureHiddenApis()
    }

    Function("isSupported") {
      SamsungSemBlur.isSupported()
    }

    // Freeze all glass samples while scrolling / heavy UI motion (optional JS hook).
    Function("setCapturesPaused") { paused: Boolean ->
      BlurCaptureCoordinator.setPaused(paused)
    }

    View(SamsungLiquidGlassView::class) {
      Prop("radius") { view: SamsungLiquidGlassView, radius: Int ->
        view.setBlurRadius(radius)
      }

      Prop("overlayColor") { view: SamsungLiquidGlassView, color: String? ->
        view.setOverlayColor(color)
      }

      Prop("cornerRadius") { view: SamsungLiquidGlassView, radius: Float ->
        view.setCornerRadius(radius)
      }

      Prop("enabled") { view: SamsungLiquidGlassView, enabled: Boolean ->
        view.setBlurEnabled(enabled)
      }

      // Min gap between live samples (nav + FABs ~48). Coordinator floors waves ~32ms.
      Prop("minRefreshMs") { view: SamsungLiquidGlassView, ms: Int ->
        view.setMinRefreshMs(ms)
      }

      // false = capture once then freeze. true = continuous Choreographer sampler (nav + FABs).
      Prop("live") { view: SamsungLiquidGlassView, live: Boolean ->
        view.setLiveCapture(live)
      }

      OnViewDidUpdateProps { view: SamsungLiquidGlassView ->
        // Only re-capture when props actually changed (avoids Moti/re-render thrash).
        view.onPropsUpdated()
      }
    }
  }
}
