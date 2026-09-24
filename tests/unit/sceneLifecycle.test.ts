const { migrateAppDelegate, sceneManifest } = require('../../plugins/withSceneLifecycle');
const source = `class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  func start() {
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)
#endif
  }
  // Existing authentication handlers must survive.
  func applicationOpenURL() {}
}`;

it('moves React startup into a window scene and preserves callback handlers', () => {
  const result = migrateAppDelegate(source);
  expect(result).not.toContain('UIScreen.main.bounds');
  expect(result.match(/factory.startReactNative/g)).toHaveLength(1);
  expect(result).toContain('UIWindow(windowScene: windowScene)');
  expect(result).toContain('reactLaunchOptions = launchOptions');
  expect(result).toContain('UIApplication.LaunchOptionsKey.userActivityType.rawValue: activity.activityType');
  expect(result).toContain('func applicationOpenURL()');
  expect(result).toContain('openURLContexts: connectionOptions.urlContexts');
  expect(result).toContain('applicationDidBecomeActive(UIApplication.shared)');
  expect(migrateAppDelegate(result)).toBe(result);
});
it('registers a single-window scene delegate', () => {
  const manifest = sceneManifest();
  expect(manifest.UIApplicationSupportsMultipleScenes).toBe(false);
  expect(manifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0].UISceneDelegateClassName)
    .toBe('$(PRODUCT_MODULE_NAME).SceneDelegate');
});
it('fails clearly if the Expo template changes', () => {
  expect(() => migrateAppDelegate('unknown')).toThrow('Unsupported AppDelegate');
});
