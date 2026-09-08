import { Toast } from "@/ui/Toast";
import { Stack } from "expo-router";
import { StudyReminderProvider } from "@/notifications/StudyReminderProvider";
import { StatusBar } from "expo-status-bar";

import { AdMobProvider } from "@/ads/AdMobProvider";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { ContentProvider } from "@/content/ContentProvider";
import { ConnectivityGate } from "@/network/ConnectivityGate";
import { useAppStore } from "@/store/useAppStore";
import { LearningSyncProvider } from "@/sync/LearningSyncProvider";
import { useThemeColors } from "@/theme/useThemeColors";

import { initializeKakaoSDK } from "@react-native-kakao/core";

initializeKakaoSDK("bb53ac5001095de0bcbd0b3a539fbdf0");

function RootNavigator() {
  const colors = useThemeColors();
  const { isReady: isAuthReady, session } = useAuth();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const isAdminMode = useAppStore((state) => state.isAdminMode);
  const canEnterHome =
    isAuthReady && hasHydrated && (session !== null || isAdminMode);
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
        <Stack.Screen
          name="legal/[document]"
          options={{ title: "법적 고지", presentation: "card" }}
        />
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
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="review"
            options={{
              title: "Review",
              headerBackButtonDisplayMode: "minimal",
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
      <Toast />
      <StatusBar style={isDarkMode ? "light" : "dark"} />
    </AdMobProvider>
  );
}

export default function RootLayout() {
  return (
    <ConnectivityGate>
      <AuthProvider>
        <ContentProvider>
          <LearningSyncProvider>
            <StudyReminderProvider>
              <RootNavigator />
            </StudyReminderProvider>
          </LearningSyncProvider>
        </ContentProvider>
      </AuthProvider>
    </ConnectivityGate>
  );
}
