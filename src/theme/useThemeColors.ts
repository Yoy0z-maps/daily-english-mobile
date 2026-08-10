import { useAppStore } from '@/store/useAppStore';
import { darkTheme, lightTheme } from '@/theme/colors';

export const useThemeColors = () => {
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  return isDarkMode ? darkTheme : lightTheme;
};
