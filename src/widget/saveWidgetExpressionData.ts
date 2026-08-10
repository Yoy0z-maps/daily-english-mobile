import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

import type { EnglishExpression } from '@/types/expression';
import type { WidgetExpressionPayload } from '@/widget/types';

export const WIDGET_STORAGE_KEY = 'widgetExpressionData';

type DailyEnglishWidgetBridge = {
  saveWidgetExpressionData?: (payload: WidgetExpressionPayload) => Promise<boolean>;
};

const bridge = NativeModules.DailyEnglishWidgetBridge as DailyEnglishWidgetBridge | undefined;

export const createWidgetPayload = (
  expression: EnglishExpression,
  streak: number
): WidgetExpressionPayload => ({
  id: expression.id,
  sentence: expression.sentence,
  meaning: expression.meaning,
  keyword: expression.keyword,
  keywordMeaning: expression.keywordMeaning,
  level: expression.level,
  streak
});

export const saveWidgetExpressionData = async (expression: EnglishExpression, streak: number) => {
  const payload = createWidgetPayload(expression, streak);

  if (Platform.OS === 'ios' && bridge?.saveWidgetExpressionData) {
    return bridge.saveWidgetExpressionData(payload);
  }

  await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(payload));
  return false;
};
