import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { signOutSocialSession } from '@/auth/socialAuth';
import { PremiumCard } from '@/components/PremiumCard';
import { StreakCard } from '@/components/StreakCard';
import { useAppStore } from '@/store/useAppStore';
import { useLearningSync } from '@/sync/LearningSyncProvider';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

const PROVIDER_LABELS: Record<string, string> = {
  apple: 'Apple',
  google: 'Google',
  kakao: '카카오'
};

const getProviderSummary = (session: ReturnType<typeof useAuth>['session']) => {
  if (!session) {
    return '로그아웃 상태';
  }

  const metadataProviders = session.user.app_metadata.providers;
  const providers = Array.isArray(metadataProviders)
    ? metadataProviders.filter((provider): provider is string => typeof provider === 'string')
    : typeof session.user.app_metadata.provider === 'string'
      ? [session.user.app_metadata.provider]
      : [];

  return providers.map((provider) => PROVIDER_LABELS[provider] ?? provider).join(', ') || '소셜 로그인';
};

export default function SettingsScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { session } = useAuth();
  const { status: syncStatus, errorMessage: syncErrorMessage, lastSyncedAt, syncNow } = useLearningSync();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isPremium = useAppStore((state) => state.isPremium);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const notificationsEnabled = useAppStore((state) => state.notificationsEnabled);
  const streak = useAppStore((state) => state.streak);
  const completedExpressionIds = useAppStore((state) => state.completedExpressionIds);
  const setPremium = useAppStore((state) => state.setPremium);
  const toggleDarkMode = useAppStore((state) => state.toggleDarkMode);
  const toggleNotifications = useAppStore((state) => state.toggleNotifications);
  const clearUserSession = useAppStore((state) => state.clearUserSession);
  const providerSummary = getProviderSummary(session);
  const syncStatusLabel =
    syncStatus === 'syncing'
      ? '동기화 중…'
      : syncStatus === 'synced'
        ? '동기화됨'
        : syncStatus === 'error'
          ? '동기화 필요'
          : '대기 중';

  const showMockAlert = (title: string) => {
    Alert.alert(title, 'MVP에서는 화면 이동/계정 처리를 mock으로만 표시합니다.');
  };

  const handleSignOut = () => {
    Alert.alert('로그아웃', '이 기기에 남은 사용자 학습 캐시도 함께 비울까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsSigningOut(true);

            try {
              await signOutSocialSession(session);
              clearUserSession();
              router.replace('/');
            } catch (error) {
              const message = error instanceof Error ? error.message : '로그아웃에 실패했습니다.';
              Alert.alert('로그아웃 실패', message);
            } finally {
              setIsSigningOut(false);
            }
          })();
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Settings</Text>
          <Text style={styles.title}>내 학습 설정</Text>
          <Text style={styles.subtitle}>학습 리듬과 앱 환경을 가볍게 관리해요.</Text>
        </View>

        <StreakCard streak={streak} completedCount={completedExpressionIds.length} />

        <PremiumCard isPremium={isPremium} onToggle={setPremium} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingTitle}>Dark Mode</Text>
              <Text style={styles.settingDescription}>앱 카드 UI를 다크 톤으로 전환합니다.</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={isDarkMode ? colors.primary : '#FFFFFF'}
            />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingTitle}>Notifications</Text>
              <Text style={styles.settingDescription}>학습 알림 mock 상태입니다.</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={notificationsEnabled ? colors.primary : '#FFFFFF'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountSummary}>
            <Text style={styles.accountLabel}>Supabase 세션</Text>
            <Text style={styles.accountValue}>
              {session ? `${providerSummary} · ${session.user.email ?? '이메일 미제공'}` : '로그아웃 상태'}
            </Text>
            {session ? <Text style={styles.accountId}>UID {session.user.id}</Text> : null}
          </View>
          <View style={styles.syncSummary}>
            <View style={styles.syncTextGroup}>
              <Text style={styles.accountLabel}>학습 데이터</Text>
              <Text style={styles.accountValue}>{syncStatusLabel}</Text>
              {lastSyncedAt ? (
                <Text style={styles.accountId}>
                  마지막 동기화 {new Date(lastSyncedAt).toLocaleString('ko-KR')}
                </Text>
              ) : null}
              {syncErrorMessage ? <Text style={styles.syncError}>{syncErrorMessage}</Text> : null}
            </View>
            <Pressable
              style={styles.syncButton}
              disabled={syncStatus === 'syncing'}
              onPress={() => {
                void syncNow();
              }}
            >
              <Text style={styles.syncButtonText}>지금 동기화</Text>
            </Pressable>
          </View>
          <Pressable style={styles.menuRow} disabled={isSigningOut} onPress={handleSignOut}>
            <Text style={styles.menuText}>{isSigningOut ? '로그아웃 중…' : '로그아웃'}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => showMockAlert('회원탈퇴하기')}>
            <Text style={[styles.menuText, styles.dangerText]}>회원탈퇴하기</Text>
            <Text style={[styles.chevron, styles.dangerText]}>›</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <Pressable style={styles.menuRow} onPress={() => showMockAlert('개인정보처리방침')}>
            <Text style={styles.menuText}>개인정보처리방침</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => showMockAlert('이용약관')}>
            <Text style={styles.menuText}>이용약관</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    accountLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800'
    },
    accountId: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 6
    },
    accountSummary: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      paddingVertical: 14
    },
    accountValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
      marginTop: 4
    },
    syncButton: {
      backgroundColor: colors.primarySoft,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    syncButtonText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900'
    },
    syncError: {
      color: colors.danger,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 6
    },
    syncSummary: {
      alignItems: 'center',
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 14
    },
    syncTextGroup: {
      flex: 1
    },
    chevron: {
      color: colors.textMuted,
      fontSize: 24,
      fontWeight: '700'
    },
    content: {
      gap: 16,
      padding: 20,
      paddingBottom: 36
    },
    dangerText: {
      color: colors.danger
    },
    header: {
      marginBottom: 2,
      marginTop: 2
    },
    kicker: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    menuRow: {
      alignItems: 'center',
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 52,
      paddingVertical: 13
    },
    menuText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900'
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1
    },
    section: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingTop: 16
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
      marginBottom: 2
    },
    settingDescription: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      marginTop: 4
    },
    settingRow: {
      alignItems: 'center',
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 15
    },
    settingTextGroup: {
      flex: 1,
      paddingRight: 16
    },
    settingTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900'
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 23,
      marginTop: 6
    },
    title: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -0.9,
      marginTop: 4
    }
  });
