# iOS 27 launch crash — version 1.0.2 (7)

All six App Review reports terminate on the main thread with `EXC_BREAKPOINT / SIGTRAP` in `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`.

The executable UUID (`0E4A122E-E9AB-3C87-A882-1997151F23B4`) matches the September 23 archive and its app dSYM. The app frame resolves with `atos` to `main (AppDelegate.swift:0)`. The relevant UIKit frames are already symbolicated.

Cause: the Xcode 27 build still starts its window in AppDelegate and does not declare a scene manifest. iOS 27 requires apps linked against its SDK to adopt the UIKit scene lifecycle.

Fix for the existing Expo SDK 56 app:
- Register a single-window SceneDelegate in UIApplicationSceneManifest.
- Keep React factory creation and Expo subscriber initialization in AppDelegate.
- Create UIWindow with UIWindowScene and start React Native from scene connection.
- Forward URL, universal link, and lifecycle callbacks to the existing AppDelegate handlers.
- Preserve these changes through the withSceneLifecycle config plugin on future prebuilds.

Reference: https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle

Before resubmission, increment the iOS build number, archive again, and verify cold launch, background/foreground, login callbacks, widget links and notification opening on a physical device using the new Release/TestFlight build. The rejected archive is unchanged.

## Verification (2026-09-24)

- AppDelegate migration/manifest tests: 3 passed.
- `expo prebuild --platform ios --no-install`: passed; migration survives regeneration.
- Physical-device architecture Release build (`iphoneos`, signing disabled): passed.
- iOS 27 simulator Release build: passed.
- iPhone 17 simulator: installed, launched, displayed onboarding; terminated and relaunched successfully.
- iPad Pro 11-inch (M5), iPadOS 27 simulator: installed, launched, displayed onboarding.
- Actual-device/TestFlight login and notification flows have not been verified in this session.
