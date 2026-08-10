import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { PremiumCard } from '@/components/PremiumCard';
import { StreakCard } from '@/components/StreakCard';
import { useAppStore } from '@/store/useAppStore';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

export default function SettingsScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const isPremium = useAppStore((state) => state.isPremium);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const notificationsEnabled = useAppStore((state) => state.notificationsEnabled);
  const streak = useAppStore((state) => state.streak);
  const completedExpressionIds = useAppStore((state) => state.completedExpressionIds);
  const setPremium = useAppStore((state) => state.setPremium);
  const toggleDarkMode = useAppStore((state) => state.toggleDarkMode);
  const toggleNotifications = useAppStore((state) => state.toggleNotifications);

  const showMockAlert = (title: string) => {
    Alert.alert(title, 'MVP에서는 화면 이동/계정 처리를 mock으로만 표시합니다.');
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
          <Pressable style={styles.menuRow} onPress={() => showMockAlert('로그아웃')}>
            <Text style={styles.menuText}>로그아웃</Text>
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
