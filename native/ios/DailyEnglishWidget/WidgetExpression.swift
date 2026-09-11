import Foundation

struct WidgetExpression: Codable, Hashable {
  let id: Int
  let sentence: String
  let meaning: String
  let keyword: String
  let keywordMeaning: String
  let level: String
  let streak: Int

  static let fallback = WidgetExpression(
    id: 0,
    sentence: "I'll look into it.",
    meaning: "확인해볼게요.",
    keyword: "look into",
    keywordMeaning: "조사하다",
    level: "B1",
    streak: 0
  )

  init(
    id: Int,
    sentence: String,
    meaning: String,
    keyword: String,
    keywordMeaning: String,
    level: String,
    streak: Int
  ) {
    self.id = id
    self.sentence = sentence
    self.meaning = meaning
    self.keyword = keyword
    self.keywordMeaning = keywordMeaning
    self.level = level
    self.streak = streak
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    self.id = try container.decodeIfPresent(Int.self, forKey: .id) ?? Self.fallback.id
    self.sentence = try container.decodeIfPresent(String.self, forKey: .sentence) ?? Self.fallback.sentence
    self.meaning = try container.decodeIfPresent(String.self, forKey: .meaning) ?? Self.fallback.meaning
    self.keyword = try container.decodeIfPresent(String.self, forKey: .keyword) ?? Self.fallback.keyword
    self.keywordMeaning =
      try container.decodeIfPresent(String.self, forKey: .keywordMeaning) ?? Self.fallback.keywordMeaning
    self.level = try container.decodeIfPresent(String.self, forKey: .level) ?? Self.fallback.level
    self.streak = try container.decodeIfPresent(Int.self, forKey: .streak) ?? Self.fallback.streak
  }

  var homeURL: URL {
    URL(string: "dailyenglish:///home")!
  }
}

// Keep the current expression at the top level so existing installations remain readable.
struct WidgetSchedule: Decodable {
  let current: WidgetExpression
  let nextExpression: WidgetExpression?
  let advanceAfterDate: String?
  let lastCompletedDate: String?

  enum CodingKeys: String, CodingKey {
    case nextExpression, advanceAfterDate, lastCompletedDate
  }

  init(from decoder: Decoder) throws {
    current = try WidgetExpression(from: decoder)
    let container = try decoder.container(keyedBy: CodingKeys.self)
    nextExpression = try container.decodeIfPresent(WidgetExpression.self, forKey: .nextExpression)
    advanceAfterDate = try container.decodeIfPresent(String.self, forKey: .advanceAfterDate)
    lastCompletedDate = try container.decodeIfPresent(String.self, forKey: .lastCompletedDate)
  }

  func expression(at date: Date, calendar: Calendar = .current) -> WidgetExpression {
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = calendar.timeZone
    formatter.dateFormat = "yyyy-MM-dd"
    let today = formatter.string(from: date)
    let selected: WidgetExpression
    if let after = advanceAfterDate, today > after, let next = nextExpression {
      selected = next
    } else {
      selected = current
    }
    let yesterday = calendar.date(byAdding: .day, value: -1, to: date) ?? date
    let expired = lastCompletedDate.map { $0 < formatter.string(from: yesterday) } ?? false
    return WidgetExpression(
      id: selected.id, sentence: selected.sentence, meaning: selected.meaning,
      keyword: selected.keyword, keywordMeaning: selected.keywordMeaning,
      level: selected.level, streak: expired ? 0 : selected.streak
    )
  }
}
