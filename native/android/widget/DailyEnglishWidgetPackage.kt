package com.dailyenglish.widget

import android.content.Context
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import org.json.JSONObject

class DailyEnglishWidgetPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(DailyEnglishWidgetBridge(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class DailyEnglishWidgetBridge(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "DailyEnglishWidgetBridge"

  @ReactMethod
  fun saveWidgetExpressionData(payload: ReadableMap, promise: Promise) {
    try {
      val saved = context.getSharedPreferences(DailyEnglishWidgetProvider.STORAGE, Context.MODE_PRIVATE)
        .edit().putString(DailyEnglishWidgetProvider.KEY, JSONObject(payload.toHashMap()).toString()).commit()
      if (!saved) {
        promise.reject("WIDGET_SAVE_FAILED", "Could not persist widget data")
        return
      }
      DailyEnglishWidgetProvider.reload(context)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("WIDGET_SAVE_FAILED", error)
    }
  }

  @ReactMethod
  fun reloadAllWidgets(promise: Promise) {
    try {
      DailyEnglishWidgetProvider.reload(context)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("WIDGET_RELOAD_FAILED", error)
    }
  }
}
