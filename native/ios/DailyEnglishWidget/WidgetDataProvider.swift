import Foundation
import WidgetKit

struct DailyEnglishEntry: TimelineEntry {
  let date: Date
  let expression: WidgetExpression
}

struct WidgetDataProvider {
  static let appGroupIdentifier = "group.com.dailyenglish.widget"
  static let storageKey = "widgetExpressionData"

  static func loadSchedule() -> WidgetSchedule? {
    guard
      let defaults = UserDefaults(suiteName: appGroupIdentifier),
      let json = defaults.string(forKey: storageKey),
      let data = json.data(using: .utf8),
      let schedule = try? JSONDecoder().decode(WidgetSchedule.self, from: data)
    else {
      return nil
    }

    return schedule
  }
}

struct DailyEnglishProvider: TimelineProvider {
  func placeholder(in context: Context) -> DailyEnglishEntry {
    DailyEnglishEntry(date: Date(), expression: .fallback)
  }

  func getSnapshot(in context: Context, completion: @escaping (DailyEnglishEntry) -> Void) {
    completion(DailyEnglishEntry(date: Date(), expression: WidgetDataProvider.loadSchedule()?.expression(at: Date()) ?? .fallback))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DailyEnglishEntry>) -> Void) {
    let now = Date()
    let calendar = Calendar.current
    let schedule = WidgetDataProvider.loadSchedule()
    // Prebuild midnight entries so the app does not need to run at the day boundary.
    // Only one completed lesson can advance; later days keep the next unstudied lesson.
    let dates = [now] + (1...3).compactMap {
      calendar.date(byAdding: .day, value: $0, to: calendar.startOfDay(for: now))
    }
    let entries = dates.map {
      DailyEnglishEntry(date: $0, expression: schedule?.expression(at: $0, calendar: calendar) ?? .fallback)
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}
