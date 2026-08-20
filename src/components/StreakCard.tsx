import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

type StreakCardProps = {
  streak: number;
  longestStreak: number;
  completedCount: number;
};

export const StreakCard = ({ streak, longestStreak, completedCount }: StreakCardProps) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.statBlock}>
        <Text style={styles.label}>연속 출석</Text>
        <View style={styles.valueRow}>
          <Ionicons color={colors.primary} name="flame" size={18} />
          <Text style={styles.value}>{streak}일</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.statBlock}>
        <Text style={styles.label}>최장 연속</Text>
        <View style={styles.valueRow}>
          <Ionicons color={colors.primary} name="trophy-outline" size={18} />
          <Text style={styles.value}>{longestStreak}일</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.statBlock}>
        <Text style={styles.label}>총 학습</Text>
        <View style={styles.valueRow}>
          <Ionicons color={colors.primary} name="checkmark-circle-outline" size={18} />
          <Text style={styles.value}>{completedCount}개</Text>
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 16,
      shadowColor: colors.cardShadow,
      shadowOpacity: 0.08,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 }
    },
    divider: {
      backgroundColor: colors.border,
      height: 42,
      marginHorizontal: 8,
      width: 1
    },
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.7,
      marginBottom: 7,
      textAlign: 'center',
      textTransform: 'uppercase'
    },
    statBlock: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center'
    },
    value: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center'
    },
    valueRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'center'
    }
  });
