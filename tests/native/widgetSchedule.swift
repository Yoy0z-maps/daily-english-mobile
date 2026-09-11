import Foundation

// Run with WidgetExpression.swift concatenated before this file using the Swift interpreter.
var calendar = Calendar(identifier: .gregorian)
calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
func date(_ value: String) -> Date {
  let formatter = ISO8601DateFormatter()
  return formatter.date(from: value)!
}
let json = """
{"id":1,"streak":4,"lastCompletedDate":"2026-03-07","advanceAfterDate":"2026-03-07","nextExpression":{"id":3,"streak":4}}
"""
let schedule = try JSONDecoder().decode(WidgetSchedule.self, from: Data(json.utf8))
assert(schedule.expression(at: date("2026-03-08T07:59:59Z"), calendar: calendar).id == 1)
assert(schedule.expression(at: date("2026-03-08T08:00:00Z"), calendar: calendar).id == 3)
assert(schedule.expression(at: date("2026-03-08T08:00:00Z"), calendar: calendar).streak == 4)
// DST starts March 8: the following midnight is only 23 hours later.
assert(schedule.expression(at: date("2026-03-09T07:00:00Z"), calendar: calendar).streak == 0)
assert(schedule.expression(at: date("2026-03-15T07:00:00Z"), calendar: calendar).id == 3)
let old = try JSONDecoder().decode(WidgetSchedule.self, from: Data("{\"id\":5,\"streak\":2}".utf8))
assert(old.expression(at: Date(), calendar: calendar).id == 5)
let unfinished = try JSONDecoder().decode(WidgetSchedule.self, from: Data("{\"id\":7,\"streak\":2,\"lastCompletedDate\":\"2026-03-06\"}".utf8))
assert(unfinished.expression(at: date("2026-03-09T07:00:00Z"), calendar: calendar).id == 7)
print("Widget schedule checks passed: midnight, DST, missed days, legacy data, unfinished lesson")
