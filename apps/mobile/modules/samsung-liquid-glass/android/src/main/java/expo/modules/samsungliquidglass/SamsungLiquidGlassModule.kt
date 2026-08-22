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

      // ms between live PixelCopy refreshes (nav ~140, FAB ~450). Shared wave ≥140ms.
      Prop("minRefreshMs") { view: SamsungLiquidGlassView, ms: Int ->
        view.setMinRefreshMs(ms)
      }

      OnViewDidUpdateProps { view: SamsungLiquidGlassView ->
        // Only re-capture when props actually changed (avoids Moti/re-render thrash).
        view.onPropsUpdated()
      }
    }
  }
}
