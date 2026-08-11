import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AdMobProvider } from "@/ads/AdMobProvider";
import { useAppStore } from "@/store/useAppStore";
import { useThemeColors } from "@/theme/useThemeColors";

import { initializeKakaoSDK } from "@react-native-kakao/core";

initializeKakaoSDK("bb53ac5001095de0bcbd0b3a539fbdf0");

export default function RootLayout() {
  const colors = useThemeColors();
  const isDarkMode = useAppStore((state) => state.isDarkMode);

  return (
    <AdMobProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "900" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="expression/[id]"
          options={{
            title: "Expression",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="review"
          options={{
            title: "Review",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="wrong-note"
          options={{
            title: "오답노트",
            presentation: "card",
          }}
        />
      </Stack>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
    </AdMobProvider>
  );
}
