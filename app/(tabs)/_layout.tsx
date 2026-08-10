import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { useThemeColors } from '@/theme/useThemeColors';

const icons = {
  home: '⌂',
  saved: '♥',
  settings: '⚙'
};

export default function TabLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 88,
          paddingBottom: 24,
          paddingTop: 10
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '900'
        },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 21, fontWeight: '900' }}>
            {icons[route.name as keyof typeof icons]}
          </Text>
        )
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
