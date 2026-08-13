import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AdMobProvider } from "@/ads/AdMobProvider";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { ContentProvider } from "@/content/ContentProvider";
import { useAppStore } from "@/store/useAppStore";
import { LearningSyncProvider } from "@/sync/LearningSyncProvider";
import { useThemeColors } from "@/theme/useThemeColors";

import { initializeKakaoSDK } from "@react-native-kakao/core";

initializeKakaoSDK("bb53ac5001095de0bcbd0b3a539fbdf0");

function RootNavigator() {
  const colors = useThemeColors();
  const { isReady: isAuthReady, session } = useAuth();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useAppStore((state) => state.hasCompletedOnboarding);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const canEnterHome =
    isAuthReady && hasHydrated && hasCompletedOnboarding && session !== null;
  const canEnterOnboarding = isAuthReady && hasHydrated && !canEnterHome;

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
        <Stack.Protected guard={canEnterOnboarding}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={canEnterHome}>
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
        </Stack.Protected>
      </Stack>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
    </AdMobProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ContentProvider>
        <LearningSyncProvider>
          <RootNavigator />
        </LearningSyncProvider>
      </ContentProvider>
    </AuthProvider>
  );
}
