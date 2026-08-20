import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useThemeColors } from '@/theme/useThemeColors';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

const icons: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  home: { active: 'home', inactive: 'home-outline' },
  saved: { active: 'bookmark', inactive: 'bookmark-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' }
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
        tabBarIcon: ({ color, focused, size }) => {
          const icon = icons[route.name] ?? icons.home;
          return <Ionicons color={color} name={focused ? icon.active : icon.inactive} size={size} />;
        }
      })}
    >
      <Tabs.Screen name="home" options={{ title: '홈' }} />
      <Tabs.Screen name="saved" options={{ title: '저장' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
