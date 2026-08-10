import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

type PremiumCardProps = {
  isPremium: boolean;
  onToggle: (value: boolean) => void;
};

const benefits = ['광고 제거', '전체 표현 열람', '퀴즈', '오답노트', 'AI 설명'];

export const PremiumCard = ({ isPremium, onToggle }: PremiumCardProps) => {
  const colors = useThemeColors();
  const styles = createStyles(colors, isPremium);

  if (isPremium) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactTextGroup}>
          <Text style={styles.kicker}>Premium Active</Text>
          <Text style={styles.compactTitle}>프리미엄 사용 중</Text>
          <Text style={styles.compactDescription}>광고 없이 퀴즈 · 오답노트 · AI 설명을 사용할 수 있어요.</Text>
        </View>
        <Pressable style={styles.compactButton} onPress={() => onToggle(false)}>
          <Text style={styles.compactButtonText}>끄기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Premium Mock</Text>
      <Text style={styles.title}>7일 무료 체험으로 시작</Text>
      <Text style={styles.description}>월 1,200원 · 연 9,900원 · 평생 29,000원</Text>

      <View style={styles.benefitGrid}>
        {benefits.map((benefit) => (
          <View key={benefit} style={styles.benefitPill}>
            <Text style={styles.benefitText}>✓ {benefit}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.button} onPress={() => onToggle(true)}>
        <Text style={styles.buttonText}>Mock Premium 켜기</Text>
      </Pressable>
    </View>
  );
};

const createStyles = (colors: AppTheme, isPremium: boolean) =>
  StyleSheet.create({
    benefitGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 16
    },
    benefitPill: {
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7
    },
    benefitText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800'
    },
    button: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 18,
      marginTop: 18,
      paddingVertical: 14
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900'
    },
    compactButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12
    },
    compactButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '900'
    },
    compactContainer: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      justifyContent: 'space-between',
      padding: 16
    },
    compactDescription: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      marginTop: 4
    },
    compactTextGroup: {
      flex: 1
    },
    compactTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3,
      marginTop: 4
    },
    container: {
      backgroundColor: isPremium ? colors.primarySoft : colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: 1,
      padding: 18
    },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 21,
      marginTop: 8
    },
    kicker: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase'
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.4,
      marginTop: 8
    }
  });
