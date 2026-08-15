import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import { useThemeColors } from '@/theme/useThemeColors';

export default function IndexScreen() {
  const colors = useThemeColors();
  const { isReady: isAuthReady, session } = useAuth();
  const hasHydrated = useAppStore((state) => state.hasHydrated);

  if (!hasHydrated || !isAuthReady) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const canEnterHome = session !== null;

  return <Redirect href={canEnterHome ? '/home' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  }
});
