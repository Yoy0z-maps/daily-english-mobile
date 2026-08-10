import { StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

export const AdBanner = () => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>AD</Text>
      <Text style={styles.text}>무료 버전 광고 placeholder</Text>
    </View>
  );
};

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderStyle: 'dashed',
      borderWidth: 1,
      gap: 4,
      justifyContent: 'center',
      minHeight: 72,
      padding: 16
    },
    label: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1
    },
    text: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600'
    }
  });
