# iOS Widget Setup

This project includes the SwiftUI + WidgetKit source files for the Daily English Home Screen and Lock Screen widget.

## App Group

- App Group ID: `group.com.dailyenglish.widget`
- Shared UserDefaults key: `widgetExpressionData`
- React Native writer: `src/widget/saveWidgetExpressionData.ts`
- Native bridge: `ios/DailyEnglishWidgetBridge/DailyEnglishWidgetBridge.swift`
- Widget reader: `ios/DailyEnglishWidget/WidgetDataProvider.swift`

## Expo flow

1. Install dependencies:

   ```sh
   npm install
   npx expo install --fix
   ```

2. Generate the iOS project without running Pods in the Korean project path:

   ```sh
   npm run ios:prebuild
   ```

3. The config plugin automatically restores these generated folders and injects the widget target:

   - `ios/DailyEnglishWidget`
   - `ios/DailyEnglishWidgetBridge`

4. If CocoaPods fails under `/Users/.../오늘의 문장`, prepare an ASCII-path build copy:

   ```sh
   npm run ios:prepare-ascii
   ```

5. Open the generated workspace in Xcode:

   ```sh
   open /private/tmp/dailyenglish-ios-build/ios/app.xcworkspace
   ```

6. In Xcode, check Signing & Capabilities for both targets:

   - `app`
   - `DailyEnglishWidget`

7. Enable App Groups for both targets if Xcode does not auto-resolve it, and add `group.com.dailyenglish.widget`.

8. Build and run on a physical iOS device or simulator that supports WidgetKit.

## Signing troubleshooting

- `PLA Update available`: Accept the latest Apple Developer Program License Agreement in your Apple Developer account, then restart Xcode.
- `DailyEnglishWidget requires a development team`: Select the same Team for both `app` and `DailyEnglishWidget`. The config plugin also copies the app target's `DEVELOPMENT_TEAM` into the widget target on prebuild.
- `Provisioning profile ... doesn't include App Groups`: Use an Apple Developer Program team that supports App Groups, then enable App Groups for both bundle identifiers.
- `doesn't support group.com.dailyenglish.widget`: Add `group.com.dailyenglish.widget` under Certificates, Identifiers & Profiles, then regenerate or let Xcode refresh the provisioning profiles.

## Deep links

- Home: `dailyenglish:///home`
- Expression detail: `dailyenglish:///expression/0`

The widget uses `.widgetURL(entry.expression.homeURL)` so tapping the widget opens the app Home route handled by Expo Router.
