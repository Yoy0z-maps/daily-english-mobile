import { router } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRef, useState } from "react";

import { SocialSignInPanel } from "@/auth/SocialSignInPanel";
import { signInWithReviewAccount } from "@/auth/socialAuth";
import { useAppStore } from "@/store/useAppStore";
import type { AppTheme } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";

const onboardingItems = [
  ["하루 1문장", "실생활에서 바로 쓰는 표현만 골라 학습해요."],
  ["위젯 복습", "홈 화면과 잠금 화면에서 오늘 문장을 바로 확인해요."],
  ["작게 꾸준히", "완료 버튼으로 스트릭과 진행도를 쌓아가요."],
];

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const enterAdminMode = useAppStore((state) => state.enterAdminMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const adminTapCountRef = useRef(0);
  const adminTapResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 심사용 데모 계정 진입: 온보딩 상단 로고를 3회 연속 탭하면 실제 Supabase 데모 계정으로 로그인한다.
  function handleLogoPress() {
    if (isSubmitting) {
      return;
    }

    adminTapCountRef.current += 1;

    if (adminTapResetTimer.current) {
      clearTimeout(adminTapResetTimer.current);
    }

    if (adminTapCountRef.current >= 3) {
      adminTapCountRef.current = 0;
      void handleReviewAccountSignIn();
      return;
    }

    adminTapResetTimer.current = setTimeout(() => {
      adminTapCountRef.current = 0;
    }, 800);
  }

  async function handleReviewAccountSignIn() {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await signInWithReviewAccount();
      // 광고 숨김 + 항상 최신 단어 표시는 로컬 어드민 플래그로 처리한다(콘텐츠가 매주 추가돼도 별도 서버 유지 관리가 필요 없다).
      enterAdminMode();
      router.replace("/");
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "심사용 계정 로그인에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleStart() {
    completeOnboarding();
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Pressable onPress={handleLogoPress} hitSlop={12}>
            <Text style={styles.eyebrow}>Daily English</Text>
          </Pressable>
          <Text style={styles.title}>
            오늘 하나만,{"\n"}내일 더 자연스럽게.
          </Text>
          <Text style={styles.subtitle}>
            명언 말고 진짜 대화에 쓰는 영어 표현을 매일 한 문장씩 익혀요.
          </Text>
        </View>

        <View style={styles.cardList}>
          {onboardingItems.map(([title, body], index) => (
            <View key={title} style={styles.itemCard}>
              <Text style={styles.itemNumber}>{index + 1}</Text>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{title}</Text>
                <Text style={styles.itemBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          style={[styles.guestButton, isSubmitting && { opacity: 0.55 }]}
          disabled={isSubmitting}
          accessibilityRole="button"
          onPress={handleStart}
        >
          <Text style={styles.guestButtonText}>로그인 없이 시작하기</Text>
        </Pressable>
        <Text style={styles.guestHint}>
          학습 기록은 이 기기에 저장되고, 나중에 설정에서 로그인하면 계정으로 옮겨져요.
        </Text>

        <View style={styles.socialPanel}>
          <SocialSignInPanel disabled={isSubmitting} onSignedIn={handleStart} />
        </View>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    cardList: {
      gap: 14,
      marginTop: 32,
    },
    container: {
      flexGrow: 1,
      padding: 24,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 1,
      marginTop: 24,
      textTransform: "uppercase",
    },
    itemBody: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 4,
    },
    itemCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      flexDirection: "row",
      gap: 14,
      padding: 16,
    },
    itemContent: {
      flex: 1,
    },
    itemNumber: {
      color: colors.primary,
      fontSize: 28,
      fontWeight: "900",
      width: 36,
    },
    itemTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 26,
      marginTop: 16,
    },
    title: {
      color: colors.text,
      fontSize: 42,
      fontWeight: "900",
      letterSpacing: -1.4,
      lineHeight: 49,
      marginTop: 14,
    },
    guestButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 18,
      marginTop: 40,
      paddingVertical: 16,
    },
    guestButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "900",
    },
    guestHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 10,
      textAlign: "center",
    },
    socialPanel: {
      marginTop: 32,
    },
    errorText: {
      textAlign: "center",
      width: "100%",
      marginBottom: 12,
      color: "#EF4444",
      fontSize: 14,
    },
  });
