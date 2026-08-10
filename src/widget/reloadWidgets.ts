import { NativeModules, Platform } from 'react-native';

type DailyEnglishWidgetBridge = {
  reloadAllWidgets?: () => Promise<boolean>;
};

const bridge = NativeModules.DailyEnglishWidgetBridge as DailyEnglishWidgetBridge | undefined;

export const reloadAllWidgets = async () => {
  if (Platform.OS !== 'ios' || !bridge?.reloadAllWidgets) {
    return false;
  }

  return bridge.reloadAllWidgets();
};
