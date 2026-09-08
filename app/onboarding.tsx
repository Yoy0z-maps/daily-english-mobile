import { router } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { useRef, useState } from "react";
import Svg, { Path } from "react-native-svg";

import { useAppStore } from "@/store/useAppStore";
import {
  signInWithApple,
  // signInWithGoogle, // TODO: 구글 로그인 재활성화 시 주석 해제
  signInWithKakao,
  signInWithReviewAccount,
} from "@/auth/socialAuth";
import type { AppTheme } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import type { AuthProvider } from "ctx";

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

  async function signInWithProvider(provider: AuthProvider) {
    switch (provider) {
      case "APPLE":
        return signInWithApple();
      case "KAKAO":
        return signInWithKakao();
      // case "GOOGLE": // TODO: 구글 로그인 재활성화 시 주석 해제
      //   return signInWithGoogle();
      case "GOOGLE":
      case "NAVER":
        throw new Error(`${provider} 로그인은 아직 준비 중입니다.`);
    }
  }

  function getSocialSignInErrorMessage(error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code.toUpperCase().includes("CANCEL")
    ) {
      return "로그인이 취소되었습니다.";
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "로그인에 오류가 발생했습니다.";
  }

  async function handleSocialSignIn(provider: AuthProvider) {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await signInWithProvider(provider);

      completeOnboarding();
      router.replace("/");
    } catch (error) {
      setErrorMsg(getSocialSignInErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
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

        <View style={styles.snsSignUpContainer}>
          <Text style={styles.snsSignUp}>SNS 계정으로 간편하게 시작하기</Text>
        </View>
        <View style={styles.authContainer}>
          <Pressable
            onPress={() => {
              void handleSocialSignIn("APPLE");
            }}
            disabled={isSubmitting}
            style={[styles.authCircleButton, { backgroundColor: "#000000" }]}
          >
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              style={{ transform: [{ translateY: -1 }] }}
            >
              <Path
                fill="white"
                d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
              />
            </Svg>
          </Pressable>
          {/* TODO: 구글 로그인 재활성화 시 주석 해제 (Google Client ID 설정 필요)
          <Pressable
            onPress={() => {
              void handleSocialSignIn("GOOGLE");
            }}
            disabled={isSubmitting}
            style={[styles.authCircleButton, { backgroundColor: "#4285F4" }]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                fill="white"
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              />
            </Svg>
          </Pressable>
          */}
          <Pressable
            onPress={() => {
              void handleSocialSignIn("KAKAO");
            }}
            disabled={isSubmitting}
            style={[
              styles.authCircleButton,
              { backgroundColor: "#FFCD00" },
              isSubmitting && { opacity: 0.55 },
            ]}
          >
            <Image
              style={{
                width: 22,
                height: 20,
              }}
              source={require("@/assets/images/kakao.png")}
            />
          </Pressable>
        </View>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoText}>
            최초 로그인 시{" "}
            <Text
              style={styles.infoTextLink}
              onPress={() => {
                router.push({
                  pathname: "/legal/[document]",
                  params: { document: "terms" },
                });
              }}
            >
              이용약관
            </Text>
            과
            <Text
              style={styles.infoTextLink}
              onPress={() => {
                router.push({
                  pathname: "/legal/[document]",
                  params: { document: "privacy" },
                });
              }}
            >
              개인정보 취급방침
            </Text>
            에
          </Text>
          <Text style={styles.infoText}>동의하는 것으로 간주합니다.</Text>
        </View>
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
    snsSignUpContainer: {
      marginTop: 60,
      width: "100%",
    },
    snsSignUp: {
      fontFamily: "WantedSans",
      fontWeight: "400",
      fontSize: 14,
      color: "#7F7F7F",
      textAlign: "center",
    },
    authContainer: {
      marginTop: 20,
      marginBottom: 20,
      justifyContent: "center",
      flexDirection: "row",
      columnGap: 16,
      width: "100%",
    },
    authCircleButton: {
      width: 50,
      height: 50,
      borderRadius: 100,
      justifyContent: "center",
      alignItems: "center",
    },
    errorText: {
      textAlign: "center",
      width: "100%",
      marginBottom: 12,
      color: "#EF4444",
      fontSize: 14,
    },
    infoTextContainer: {
      marginBottom: 16,
      justifyContent: "center",
      flexDirection: "column",
      width: "100%",
      rowGap: 2,
    },
    infoText: {
      fontFamily: "WantedSans",
      fontWeight: "400",
      fontSize: 14,
      color: "#7F7F7F",
      textAlign: "center",
    },
    infoTextLink: {
      textDecorationLine: "underline",
    },
  });
