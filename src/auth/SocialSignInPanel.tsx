import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  signInWithApple,
  signInWithGoogle,
  signInWithKakao,
} from "@/auth/socialAuth";
import type { AuthProvider } from "ctx";

type SocialSignInPanelProps = {
  title?: string;
  disabled?: boolean;
  onSignedIn: () => void;
};

async function signInWithProvider(provider: AuthProvider) {
  switch (provider) {
    case "APPLE":
      return signInWithApple();
    case "KAKAO":
      return signInWithKakao();
    case "GOOGLE":
      return signInWithGoogle();
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

// 소셜 로그인 버튼 묶음. 처음 로그인하는 계정은 Supabase에서 자동으로 회원가입된다.
export function SocialSignInPanel({
  title = "SNS 계정으로 간편하게 시작하기",
  disabled = false,
  onSignedIn,
}: SocialSignInPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isDisabled = disabled || isSubmitting;

  async function handleSocialSignIn(provider: AuthProvider) {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await signInWithProvider(provider);
      onSignedIn();
    } catch (error) {
      setErrorMsg(getSocialSignInErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View>
      <View style={styles.snsSignUpContainer}>
        <Text style={styles.snsSignUp}>{title}</Text>
      </View>
      <View style={styles.authContainer}>
        <Pressable
          onPress={() => {
            void handleSocialSignIn("APPLE");
          }}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel="Apple로 로그인"
          style={[
            styles.authCircleButton,
            { backgroundColor: "#000000" },
            isDisabled && { opacity: 0.55 },
          ]}
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
        <Pressable
          onPress={() => {
            void handleSocialSignIn("GOOGLE");
          }}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel="Google로 로그인"
          accessibilityState={{ disabled: isDisabled, busy: isSubmitting }}
          style={[
            styles.authCircleButton,
            { backgroundColor: "#4285F4" },
            isDisabled && { opacity: 0.55 },
          ]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path
              fill="white"
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
            />
          </Svg>
        </Pressable>
        <Pressable
          onPress={() => {
            void handleSocialSignIn("KAKAO");
          }}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel="카카오로 로그인"
          style={[
            styles.authCircleButton,
            { backgroundColor: "#FFCD00" },
            isDisabled && { opacity: 0.55 },
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
    </View>
  );
}

const styles = StyleSheet.create({
  snsSignUpContainer: {
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
