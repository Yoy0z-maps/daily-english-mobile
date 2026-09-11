import type { EnglishExpression } from '@/types/expression';
import type { WidgetExpressionPayload } from '@/widget/types';

export type WidgetSchedule = {
  nextExpression?: EnglishExpression;
  lastCompletedDate?: string | null;
};

const fields = (expression: EnglishExpression, streak: number) => ({
  id: expression.id,
  sentence: expression.sentence,
  meaning: expression.meaning,
  keyword: expression.keyword,
  keywordMeaning: expression.keywordMeaning,
  level: expression.level,
  streak
});

export const createWidgetPayload = (
  expression: EnglishExpression,
  streak: number,
  schedule: WidgetSchedule = {}
): WidgetExpressionPayload => ({
  ...fields(expression, streak),
  lastCompletedDate: schedule.lastCompletedDate ?? null,
  ...(schedule.nextExpression && schedule.lastCompletedDate
    ? {
        nextExpression: fields(schedule.nextExpression, streak),
        advanceAfterDate: schedule.lastCompletedDate
      }
    : {})
});
