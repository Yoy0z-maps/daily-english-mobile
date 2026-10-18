import { router, Stack } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SocialSignInPanel } from '@/auth/SocialSignInPanel';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { showToast } from '@/ui/Toast';

const benefits = [
  ['기록 옮기기', '이 기기에 쌓인 학습 기록·저장 문장·오답노트가 계정으로 옮겨져요.'],
  ['어디서나 이어서', '다른 기기에서 같은 계정으로 로그인하면 그대로 이어서 학습해요.'],
  ['간편 회원가입', '처음 로그인하는 계정은 자동으로 회원가입돼요.']
];

// 게스트 사용자가 설정의 "동기화 진행하기"를 눌렀을 때 열리는 로그인/회원가입 화면.
export default function LoginScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const handleSignedIn = () => {
    // 세션이 생기면 LearningSyncProvider가 게스트 기록을 계정으로 옮긴 뒤 동기화한다.
    showToast('로그인했어요. 학습 기록을 동기화하고 있어요.');
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/settings');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: '로그인 · 회원가입' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>Sync</Text>
        <Text style={styles.title}>로그인하고{'\n'}학습 기록을 지켜요</Text>
        <Text style={styles.subtitle}>지금은 학습 기록이 이 기기에만 저장되어 있어요.</Text>

        <View style={styles.cardList}>
          {benefits.map(([title, body]) => (
            <View key={title} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{title}</Text>
              <Text style={styles.itemBody}>{body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <SocialSignInPanel title="SNS 계정으로 로그인 또는 회원가입" onSignedIn={handleSignedIn} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    cardList: { gap: 12, marginTop: 28 },
    content: { flexGrow: 1, padding: 24 },
    itemBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 4 },
    itemCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      padding: 16
    },
    itemTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
    kicker: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    panel: { marginTop: 40 },
    safeArea: { backgroundColor: colors.background, flex: 1 },
    subtitle: { color: colors.textMuted, fontSize: 15, fontWeight: '700', lineHeight: 23, marginTop: 10 },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: -0.9,
      lineHeight: 38,
      marginTop: 6
    }
  });
