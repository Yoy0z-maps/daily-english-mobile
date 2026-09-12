const APP_GROUP_IDENTIFIER = "group.com.dailyenglish.widget";
const IOS_BUNDLE_IDENTIFIER = "com.dailyenglish.sentences";
const WIDGET_BUNDLE_IDENTIFIER = `${IOS_BUNDLE_IDENTIFIER}.DailyEnglishWidget`;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? "GQM6B63P8T";
const ADMOB_ANDROID_APP_ID =
  process.env.ADMOB_ANDROID_APP_ID ?? "ca-app-pub-3780332868290454~6325666938";
const ADMOB_IOS_APP_ID =
  process.env.ADMOB_IOS_APP_ID ?? "ca-app-pub-3780332868290454~1675975485";
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const GOOGLE_IOS_URL_SCHEME = GOOGLE_IOS_CLIENT_ID?.endsWith(
  ".apps.googleusercontent.com",
)
  ? `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.slice(
      0,
      -".apps.googleusercontent.com".length,
    )}`
  : null;
const GOOGLE_SIGN_IN_PLUGINS = GOOGLE_IOS_URL_SCHEME
  ? [
      [
        "react-native-nitro-google-signin",
        {
          iosUrlScheme: GOOGLE_IOS_URL_SCHEME,
        },
      ],
    ]
  : [];
const GOOGLE_SIGN_IN_EXTRA_IOS_PODS = GOOGLE_IOS_URL_SCHEME
  ? []
  : [
      { name: "AppCheckCore", modular_headers: true },
      { name: "GoogleUtilities", modular_headers: true },
      { name: "RecaptchaInterop", modular_headers: true },
    ];

// Keep this list aligned with Google's current iOS Mobile Ads quick-start guide.
const ADMOB_SK_AD_NETWORK_ITEMS = [
  "cstr6suwn9.skadnetwork",
  "4fzdc2evr5.skadnetwork",
  "2fnua5tdw4.skadnetwork",
  "ydx93a7ass.skadnetwork",
  "p78axxw29g.skadnetwork",
  "v72qych5uu.skadnetwork",
  "ludvb6z3bs.skadnetwork",
  "cp8zw746q7.skadnetwork",
  "3sh42y64q3.skadnetwork",
  "c6k4g5qg8m.skadnetwork",
  "s39g8k73mm.skadnetwork",
  "wg4vff78zm.skadnetwork",
  "3qy4746246.skadnetwork",
  "f38h382jlk.skadnetwork",
  "hs6bdukanm.skadnetwork",
  "mlmmfzh3r3.skadnetwork",
  "v4nxqhlyqp.skadnetwork",
  "wzmmz9fp6w.skadnetwork",
  "su67r6k2v3.skadnetwork",
  "yclnxrl5pm.skadnetwork",
  "t38b2kh725.skadnetwork",
  "7ug5zh24hu.skadnetwork",
  "gta9lk7p23.skadnetwork",
  "vutu7akeur.skadnetwork",
  "y5ghdn5j9k.skadnetwork",
  "v9wttpbfk9.skadnetwork",
  "n38lu8286q.skadnetwork",
  "47vhws6wlr.skadnetwork",
  "kbd757ywx3.skadnetwork",
  "9t245vhmpl.skadnetwork",
  "a2p9lx4jpn.skadnetwork",
  "22mmun2rn5.skadnetwork",
  "44jx6755aq.skadnetwork",
  "k674qkevps.skadnetwork",
  "4468km3ulz.skadnetwork",
  "2u9pt9hc89.skadnetwork",
  "8s468mfl3y.skadnetwork",
  "klf5c3l5u5.skadnetwork",
  "ppxm28t8ap.skadnetwork",
  "kbmxgpxpgc.skadnetwork",
  "uw77j35x4d.skadnetwork",
  "578prtvx9j.skadnetwork",
  "4dzt52r2t5.skadnetwork",
  "tl55sbb4fm.skadnetwork",
  "c3frkrj4fj.skadnetwork",
  "e5fvkxwrpn.skadnetwork",
  "8c4e2ghe7u.skadnetwork",
  "3rd42ekr43.skadnetwork",
  "97r2b46745.skadnetwork",
  "3qcr597p9d.skadnetwork",
];

module.exports = {
  expo: {
    name: "오늘의 문장",
    slug: "daily-english-sentence",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./src/assets/icon/icon.png",
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
      buildNumber: "6",
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
      "expo-notifications",
      "expo-apple-authentication",
      ...GOOGLE_SIGN_IN_PLUGINS,
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: ADMOB_ANDROID_APP_ID,
          iosAppId: ADMOB_IOS_APP_ID,
          delayAppMeasurementInit: true,
          skAdNetworkItems: ADMOB_SK_AD_NETWORK_ITEMS,
        },
      ],
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
          ios: {
            extraPods: GOOGLE_SIGN_IN_EXTRA_IOS_PODS,
          },
          android: {
            extraMavenRepos: [
              "https://devrepo.kakao.com/nexus/content/groups/public/",
            ],
            extraProguardRules:
              "-keep class com.google.android.gms.internal.consent_sdk.** { *; }",
            kotlinVersion: "2.1.20",
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
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
