package com.dailyenglish.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.appwidget.AppWidgetProviderInfo
import android.widget.RemoteViews
import org.json.JSONObject
import java.time.LocalDate
import com.dailyenglish.sentences.R

open class DailyEnglishWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { update(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    update(context, manager, id)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action in listOf(Intent.ACTION_DATE_CHANGED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED)) {
      reload(context)
    }
  }

  companion object {
    const val STORAGE = "daily_english_widget"
    const val KEY = "widgetExpressionData"

    fun reload(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      listOf(DailyEnglishWidgetProvider::class.java, DailyEnglishCircularWidgetProvider::class.java,
        DailyEnglishRectangularWidgetProvider::class.java, DailyEnglishInlineWidgetProvider::class.java).forEach { provider ->
        manager.getAppWidgetIds(ComponentName(context, provider)).forEach { update(context, manager, it) }
      }
    }

    private fun update(context: Context, manager: AppWidgetManager, id: Int) {
      val payload = runCatching {
        JSONObject(context.getSharedPreferences(STORAGE, Context.MODE_PRIVATE).getString(KEY, "{}") ?: "{}")
      }.getOrDefault(JSONObject())
      val today = LocalDate.now()
      val after = payload.optString("advanceAfterDate", "")
      val selected = if (after.isNotEmpty() && today.toString() > after) {
        payload.optJSONObject("nextExpression") ?: payload
      } else payload
      val completed = payload.optString("lastCompletedDate", "")
      val expired = completed.isNotEmpty() && completed != "null" && completed < today.minusDays(1).toString()
      val streak = if (expired) 0 else selected.optInt("streak", 0)
      val options = manager.getAppWidgetOptions(id)
      val provider = manager.getAppWidgetInfo(id)?.provider?.className.orEmpty()
      val keyguard = options.getInt(AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY) == AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD
      val kind = when {
        provider.endsWith("CircularWidgetProvider") -> "circular"
        provider.endsWith("InlineWidgetProvider") -> "inline"
        provider.endsWith("RectangularWidgetProvider") || keyguard -> "rectangular"
        else -> "home"
      }
      fun render(width: Int): RemoteViews {
        val small = width < 230
        val layout = when (kind) {
          "circular" -> R.layout.daily_english_widget_circular
          "inline" -> R.layout.daily_english_widget_inline
          "rectangular" -> R.layout.daily_english_widget_rectangular
          else -> if (small) R.layout.daily_english_widget_small else R.layout.daily_english_widget
        }
        val views = RemoteViews(context.packageName, layout)
        val sentence = selected.optString("sentence", "오늘의 영어 문장을 만나보세요")
        if (kind == "circular") {
          views.setTextViewText(R.id.widget_status, if (streak > 0) "🔥$streak" else selected.optString("level", "EN"))
        } else {
          views.setTextViewText(R.id.widget_sentence, if (kind == "inline") "EN: $sentence" else sentence)
          if (kind != "inline") views.setTextViewText(R.id.widget_meaning, selected.optString("meaning", "앱을 열어 학습을 시작하세요."))
        }
        if (kind == "home") {
          views.setTextViewText(R.id.widget_level, selected.optString("level", "EN"))
          views.setTextViewText(R.id.widget_keyword, selected.optString("keyword", "매일 한 문장씩"))
          if (!small) views.setTextViewText(R.id.widget_keyword_meaning, " · ${selected.optString("keywordMeaning", "")}")
        }
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("dailyenglish:///home"))
          .setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        return views
      }
      // Supply both orientations; resize callbacks also recalculate small/medium presentation.
      val portraitWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
      val landscapeWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, portraitWidth)
      val views = RemoteViews(render(landscapeWidth), render(portraitWidth))
      manager.updateAppWidget(id, views)
    }
  }
}

class DailyEnglishCircularWidgetProvider : DailyEnglishWidgetProvider()
class DailyEnglishRectangularWidgetProvider : DailyEnglishWidgetProvider()
class DailyEnglishInlineWidgetProvider : DailyEnglishWidgetProvider()
