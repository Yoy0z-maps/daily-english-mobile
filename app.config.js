const APP_GROUP_IDENTIFIER = "group.com.dailyenglish.widget";
const IOS_BUNDLE_IDENTIFIER = "com.dailyenglish.sentences";
const WIDGET_BUNDLE_IDENTIFIER = `${IOS_BUNDLE_IDENTIFIER}.DailyEnglishWidget`;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? "GQM6B63P8T";

module.exports = {
  expo: {
    name: "오늘의 문장",
    slug: "daily-english-sentence",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "dailyenglish",
    jsEngine: "jsc",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      backgroundColor: "#F7F8FF",
    },
    ios: {
      bundleIdentifier: IOS_BUNDLE_IDENTIFIER,
      appleTeamId: APPLE_TEAM_ID,
      supportsTablet: true,
      entitlements: {
        "com.apple.security.application-groups": [APP_GROUP_IDENTIFIER],
      },
      infoPlist: {
        CFBundleDisplayName: "오늘의 문장",
      },
    },
    android: {
      package: "com.dailyenglish.sentences",
    },
    web: {
      bundler: "metro",
    },
    plugins: [
      "expo-router",
      "expo-apple-authentication",
      [
        "./plugins/withDailyEnglishWidget",
        {
          groupIdentifier: APP_GROUP_IDENTIFIER,
          developmentTeam: APPLE_TEAM_ID,
          widgetBundleIdentifier: WIDGET_BUNDLE_IDENTIFIER,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            extraMavenRepos: [
              "https://devrepo.kakao.com/nexus/content/groups/public/",
            ],
          },
        },
      ],
      [
        "@react-native-kakao/core",
        {
          nativeAppKey: "bb53ac5001095de0bcbd0b3a539fbdf0",
          android: {
            authCodeHandlerActivity: true,
          },
          ios: {
            handleKakaoOpenUrl: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appGroupIdentifier: APP_GROUP_IDENTIFIER,
    },
  },
};
