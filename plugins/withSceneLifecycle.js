const fs = require('fs');
const path = require('path');
const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');
const marker = '// daily-english: scene lifecycle';

function migrateAppDelegate(source) {
  const scene = fs.readFileSync(path.join(__dirname, '../native/ios/SceneDelegate.swift'), 'utf8');
  if (source.includes(marker)) return source.slice(0, source.indexOf(marker)) + `${marker}\n${scene}`;
  const startup = /#if os\(iOS\) \|\| os\(tvOS\)\s+window = UIWindow\(frame: UIScreen.main.bounds\)[\s\S]*?#endif/;
  if (!startup.test(source) || !source.includes('var window: UIWindow?')) {
    throw new Error('Unsupported AppDelegate template for scene lifecycle migration.');
  }
  return source
    .replace('var window: UIWindow?', 'var window: UIWindow?\n  var reactLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?')
    .replace(startup, '    reactLaunchOptions = launchOptions') + `\n${marker}\n${scene}`;
}

function sceneManifest() {
  return {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [{
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate'
      }]
    }
  };
}

module.exports = (config) => {
  config = withInfoPlist(config, (result) => {
    result.modResults.UIApplicationSceneManifest = sceneManifest();
    return result;
  });
  return withAppDelegate(config, (result) => {
    if (result.modResults.language !== 'swift') throw new Error('Scene lifecycle requires Swift AppDelegate.');
    result.modResults.contents = migrateAppDelegate(result.modResults.contents);
    return result;
  });
};
module.exports.migrateAppDelegate = migrateAppDelegate;
module.exports.sceneManifest = sceneManifest;
