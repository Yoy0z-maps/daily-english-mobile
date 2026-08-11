import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { useThemeColors } from '@/theme/useThemeColors';

export default function IndexScreen() {
  const colors = useThemeColors();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useAppStore((state) => state.hasCompletedOnboarding);
  const adAgeTreatment = useAppStore((state) => state.adAgeTreatment);

  if (!hasHydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Redirect href={adAgeTreatment !== null && hasCompletedOnboarding ? '/home' : '/onboarding'} />
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  }
});
