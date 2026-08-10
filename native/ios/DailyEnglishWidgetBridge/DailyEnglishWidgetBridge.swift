import Foundation
import React
import WidgetKit

@objc(DailyEnglishWidgetBridge)
class DailyEnglishWidgetBridge: NSObject {
  private let appGroupIdentifier = "group.com.dailyenglish.widget"
  private let storageKey = "widgetExpressionData"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(saveWidgetExpressionData:resolver:rejecter:)
  func saveWidgetExpressionData(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
      reject("APP_GROUP_UNAVAILABLE", "Unable to open App Group UserDefaults.", nil)
      return
    }

    do {
      let data = try JSONSerialization.data(withJSONObject: payload, options: [])
      guard let json = String(data: data, encoding: .utf8) else {
        reject("WIDGET_ENCODING_FAILED", "Unable to encode widget payload.", nil)
        return
      }

      defaults.set(json, forKey: storageKey)
      defaults.synchronize()
      reloadTimelines()
      resolve(true)
    } catch {
      reject("WIDGET_SAVE_FAILED", error.localizedDescription, error)
    }
  }

  @objc(reloadAllWidgets:rejecter:)
  func reloadAllWidgets(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    reloadTimelines()
    resolve(true)
  }

  private func reloadTimelines() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
