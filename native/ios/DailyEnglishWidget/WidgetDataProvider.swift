import Foundation
import WidgetKit

struct DailyEnglishEntry: TimelineEntry {
  let date: Date
  let expression: WidgetExpression
}

struct WidgetDataProvider {
  static let appGroupIdentifier = "group.com.dailyenglish.widget"
  static let storageKey = "widgetExpressionData"

  static func loadExpression() -> WidgetExpression {
    guard
      let defaults = UserDefaults(suiteName: appGroupIdentifier),
      let json = defaults.string(forKey: storageKey),
      let data = json.data(using: .utf8),
      let expression = try? JSONDecoder().decode(WidgetExpression.self, from: data)
    else {
      return .fallback
    }

    return expression
  }
}

struct DailyEnglishProvider: TimelineProvider {
  func placeholder(in context: Context) -> DailyEnglishEntry {
    DailyEnglishEntry(date: Date(), expression: .fallback)
  }

  func getSnapshot(in context: Context, completion: @escaping (DailyEnglishEntry) -> Void) {
    completion(DailyEnglishEntry(date: Date(), expression: WidgetDataProvider.loadExpression()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DailyEnglishEntry>) -> Void) {
    let entry = DailyEnglishEntry(date: Date(), expression: WidgetDataProvider.loadExpression())
    let nextRefresh = Calendar.current.date(byAdding: .hour, value: 6, to: Date()) ?? Date().addingTimeInterval(21_600)
    completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
  }
}
