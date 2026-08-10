import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

type PremiumLockCardProps = {
  title: string;
  description: string;
  buttonLabel?: string;
};

export const PremiumLockCard = ({ title, description, buttonLabel = '프로 구독하기' }: PremiumLockCardProps) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const setPremium = useAppStore((state) => state.setPremium);

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Premium</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Pressable style={styles.button} onPress={() => setPremium(true)}>
        <Text style={styles.buttonText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
};

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 18,
      marginTop: 16,
      paddingVertical: 14
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900'
    },
    container: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: 1,
      padding: 20
    },
    description: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 23,
      marginTop: 8
    },
    kicker: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    title: {
      color: colors.text,
      fontSize: 21,
      fontWeight: '900',
      letterSpacing: -0.4,
      marginTop: 8
    }
  });
