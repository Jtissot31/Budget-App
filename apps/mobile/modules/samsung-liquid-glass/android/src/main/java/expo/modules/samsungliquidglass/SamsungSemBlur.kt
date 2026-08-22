package expo.modules.samsungliquidglass

import android.graphics.Color
import android.os.Build
import android.util.Log
import android.view.View
import org.lsposed.hiddenapibypass.HiddenApiBypass
import java.lang.reflect.Constructor
import java.lang.reflect.Method

/**
 * One UI / Samsung SemBlurInfo via reflection + hidden-API exemption.
 *
 * This is the same frosted “liquid glass” path Samsung uses for system chrome
 * (nav bars, panels). It is not AOSP cross-window blur — so it does not go
 * fully transparent when SurfaceFlinger disables window blurs at runtime.
 *
 * S25 / One UI 7–8 (API 35–36) blocks `android.view.SemBlurInfo` as a non-SDK
 * interface; Class.forName + getMethod often false-negative without exemptions.
 */
object SamsungSemBlur {
  private const val TAG = "SamsungSemBlur"

  private val BLUR_INFO_CLASSES = listOf(
    "android.view.SemBlurInfo",
    "com.samsung.android.view.SemBlurInfo",
    "com.samsung.android.graphics.SemBlurInfo",
  )

  private var hiddenApisReady = false

  fun ensureHiddenApis() {
    if (hiddenApisReady) return
    hiddenApisReady = true
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return
    try {
      HiddenApiBypass.addHiddenApiExemptions(
        "Landroid/view/SemBlurInfo",
        "Landroid/view/View",
        "Lcom/samsung/android/view/",
        "Lcom/samsung/android/graphics/",
      )
    } catch (error: Throwable) {
      Log.w(TAG, "addHiddenApiExemptions failed", error)
      try {
        HiddenApiBypass.setHiddenApiExemptions("")
      } catch (inner: Throwable) {
        Log.w(TAG, "setHiddenApiExemptions failed", inner)
      }
    }
    try {
      val clazz = Class.forName("dalvik.system.VMRuntime")
      val runtime = clazz.getDeclaredMethod("getRuntime").invoke(null)
      clazz
        .getDeclaredMethod("setHiddenApiExemptions", Array<String>::class.java)
        .invoke(runtime, arrayOf("L"))
    } catch (_: Throwable) {
      // HiddenApiBypass is the primary path on API 36.
    }
  }

  fun isSamsungDevice(): Boolean {
    val manufacturer = Build.MANUFACTURER?.lowercase().orEmpty()
    val brand = Build.BRAND?.lowercase().orEmpty()
    return manufacturer.contains("samsung") || brand.contains("samsung")
  }

  fun isSupported(): Boolean {
    if (!isSamsungDevice() || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return false
    }
    ensureHiddenApis()
    if (resolveBlurInfoClass() != null) return true
    return findViewMethod(
      View::class.java,
      listOf("semSetBlurInfo", "hidden_semSetBlurInfo"),
      Any::class.java,
    ) != null
  }

  fun apply(
    view: View,
    radius: Int,
    overlayColor: Int,
    cornerRadius: Float,
    captured: android.graphics.Bitmap? = null,
  ): Boolean {
    if (!isSamsungDevice() || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return false
    ensureHiddenApis()

    val clampedRadius = radius.coerceIn(1, 200)
    val maxCorner = minOf(view.width, view.height) / 2f
    val corner =
      if (maxCorner > 0f) minOf(cornerRadius.coerceAtLeast(0f), maxCorner) else cornerRadius.coerceAtLeast(0f)

    val blurInfoClass = resolveBlurInfoClass() ?: run {
      Log.w(TAG, "SemBlurInfo class not found")
      return false
    }
    val builderClass =
      resolveClass("${blurInfoClass.name}\$Builder")
        ?: resolveClass("${blurInfoClass.name}.Builder")
        ?: run {
          Log.w(TAG, "SemBlurInfo.Builder not found")
          return false
        }

    // Mode 1 = BLUR_MODE_WINDOW_CAPTURED — required for in-app content (needs bitmap).
    if (captured != null) {
      val capturedInfo =
        buildBlurInfo(builderClass, 1, clampedRadius, overlayColor, corner, captured)
      if (capturedInfo != null && setBlurInfo(view, blurInfoClass, capturedInfo)) {
        return true
      }
    }

    // Mode 0 = BLUR_MODE_WINDOW — live compositor blur (other windows / wallpaper).
    val windowInfo = buildBlurInfo(builderClass, 0, clampedRadius, overlayColor, corner, null)
    if (windowInfo != null && setBlurInfo(view, blurInfoClass, windowInfo)) {
      return true
    }
    Log.w(TAG, "semSetBlurInfo failed")
    return false
  }

  fun clear(view: View) {
    try {
      ensureHiddenApis()
      val blurInfoClass = resolveBlurInfoClass() ?: return
      val setMethod =
        findViewMethod(view.javaClass, listOf("semSetBlurInfo", "hidden_semSetBlurInfo"), blurInfoClass)
          ?: findViewMethod(view.javaClass, listOf("semSetBlurInfo", "hidden_semSetBlurInfo"), Any::class.java)
      setMethod?.invoke(view, null)
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun buildBlurInfo(
    builderClass: Class<*>,
    mode: Int,
    radius: Int,
    overlayColor: Int,
    cornerRadius: Float,
    captured: android.graphics.Bitmap?,
  ): Any? {
    val builder = newBuilder(builderClass, mode) ?: return null
    invokeBuilder(builder, builderClass, listOf("setRadius", "hidden_setRadius"), radius)
    if (captured != null) {
      invokeBuilder(
        builder,
        builderClass,
        listOf("setCapturedBitmap", "hidden_setCapturedBitmap", "setBitmap", "hidden_setBitmap"),
        captured,
      )
    }
    if (mode != 1) {
      invokeBuilder(
        builder,
        builderClass,
        listOf("setBackgroundColor", "hidden_setBackgroundColor"),
        overlayColor,
      )
      invokeBuilder(
        builder,
        builderClass,
        listOf("setBackgroundCornerRadius", "hidden_setBackgroundCornerRadius"),
        cornerRadius,
        cornerRadius,
        cornerRadius,
        cornerRadius,
      )
      invokeBuilder(
        builder,
        builderClass,
        listOf("setBackgroundCornerRadius", "hidden_setBackgroundCornerRadius"),
        cornerRadius,
      )
      val isLight =
        Color.alpha(overlayColor) > 0 &&
          (Color.red(overlayColor) + Color.green(overlayColor) + Color.blue(overlayColor)) / 3 > 160
      invokeBuilder(
        builder,
        builderClass,
        listOf("setColorCurvePreset", "hidden_setColorCurvePreset"),
        if (isLight) 115 else 130,
      )
      invokeBuilder(builder, builderClass, listOf("setClipToOutline", "hidden_setClipToOutline"), true)
    }
    return try {
      findMethod(builderClass, listOf("build"), emptyArray())?.invoke(builder)
    } catch (error: Throwable) {
      Log.w(TAG, "Builder.build failed mode=$mode: ${error.cause ?: error}")
      null
    }
  }

  private fun newBuilder(builderClass: Class<*>, mode: Int): Any? {
    val intCtor = findConstructor(builderClass, arrayOf(Int::class.javaPrimitiveType!!))
    if (intCtor != null) {
      return try {
        intCtor.newInstance(mode)
      } catch (error: Throwable) {
        Log.w(TAG, "Builder(int) failed mode=$mode", error)
        null
      }
    }
    val emptyCtor = findConstructor(builderClass, emptyArray())
    return try {
      emptyCtor?.newInstance()
    } catch (_: Throwable) {
      null
    }
  }

  private fun setBlurInfo(view: View, blurInfoClass: Class<*>, blurInfo: Any): Boolean {
    val setMethod =
      findViewMethod(view.javaClass, listOf("semSetBlurInfo", "hidden_semSetBlurInfo"), blurInfoClass)
        ?: findViewMethod(view.javaClass, listOf("semSetBlurInfo", "hidden_semSetBlurInfo"), Any::class.java)
        ?: return false
    return try {
      setMethod.invoke(view, blurInfo)
      true
    } catch (error: Throwable) {
      Log.w(TAG, "semSetBlurInfo invoke failed", error)
      false
    }
  }

  private fun resolveBlurInfoClass(): Class<*>? {
    for (name in BLUR_INFO_CLASSES) {
      resolveClass(name)?.let { return it }
    }
    return null
  }

  private fun resolveClass(name: String): Class<*>? {
    return try {
      Class.forName(name)
    } catch (_: Throwable) {
      try {
        HiddenApiBypass::class.java.classLoader?.loadClass(name)
      } catch (_: Throwable) {
        null
      }
    }
  }

  private fun invokeBuilder(
    builder: Any,
    builderClass: Class<*>,
    names: List<String>,
    vararg args: Any,
  ) {
    val paramTypes =
      Array(args.size) { index ->
        when (val value = args[index]) {
          is Int -> Int::class.javaPrimitiveType!!
          is Float -> Float::class.javaPrimitiveType!!
          is Boolean -> Boolean::class.javaPrimitiveType!!
          else -> value.javaClass
        }
      }
    val method = findMethod(builderClass, names, paramTypes) ?: return
    try {
      method.invoke(builder, *args)
    } catch (_: Throwable) {
      // optional APIs (color curve / clip) may be missing
    }
  }

  private fun findConstructor(clazz: Class<*>, paramTypes: Array<Class<*>>): Constructor<*>? {
    try {
      val ctor = HiddenApiBypass.getDeclaredConstructor(clazz, *paramTypes)
      ctor.isAccessible = true
      return ctor
    } catch (_: Throwable) {
      // fall through
    }
    return try {
      clazz.getDeclaredConstructor(*paramTypes).also { it.isAccessible = true }
    } catch (_: Throwable) {
      try {
        clazz.getConstructor(*paramTypes)
      } catch (_: Throwable) {
        null
      }
    }
  }

  private fun findMethod(clazz: Class<*>, names: List<String>, paramTypes: Array<Class<*>>): Method? {
    for (name in names) {
      try {
        val method = HiddenApiBypass.getDeclaredMethod(clazz, name, *paramTypes) as Method
        method.isAccessible = true
        return method
      } catch (_: Throwable) {
        // try next
      }
      try {
        return clazz.getDeclaredMethod(name, *paramTypes).also { it.isAccessible = true }
      } catch (_: Throwable) {
        try {
          return clazz.getMethod(name, *paramTypes)
        } catch (_: Throwable) {
          // continue
        }
      }
    }
    return findMethodByName(clazz, names, paramTypes.size)
  }

  private fun findMethodByName(clazz: Class<*>, names: List<String>, argc: Int): Method? {
    val methods =
      try {
        HiddenApiBypass.getDeclaredMethods(clazz).filterIsInstance<Method>()
      } catch (_: Throwable) {
        clazz.declaredMethods.toList()
      }
    return methods.firstOrNull { method ->
      names.contains(method.name) && method.parameterTypes.size == argc
    }?.also { it.isAccessible = true }
  }

  private fun findViewMethod(
    start: Class<*>,
    names: List<String>,
    vararg paramTypes: Class<*>,
  ): Method? {
    var current: Class<*>? = start
    while (current != null) {
      findMethod(current, names, arrayOf(*paramTypes))?.let { return it }
      current = current.superclass
    }
    return null
  }
}
