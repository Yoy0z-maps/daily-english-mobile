import { createWidgetPayload, type WidgetSchedule } from '@/widget/createWidgetPayload';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

import type { EnglishExpression } from '@/types/expression';
import type { WidgetExpressionPayload } from '@/widget/types';

export const WIDGET_STORAGE_KEY = 'widgetExpressionData';

type DailyEnglishWidgetBridge = {
  saveWidgetExpressionData?: (payload: WidgetExpressionPayload) => Promise<boolean>;
};

const bridge = NativeModules.DailyEnglishWidgetBridge as DailyEnglishWidgetBridge | undefined;

export { createWidgetPayload } from '@/widget/createWidgetPayload';

export const saveWidgetExpressionData = async (
  expression: EnglishExpression,
  streak: number,
  schedule: WidgetSchedule = {}
) => {
  const payload = createWidgetPayload(expression, streak, schedule);

  if ((Platform.OS === 'ios' || Platform.OS === 'android') && bridge?.saveWidgetExpressionData) {
    return bridge.saveWidgetExpressionData(payload);
  }

  await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(payload));
  return false;
};
