import type { EnglishExpression } from '@/types/expression';

export type WidgetExpressionPayload = Pick<
  EnglishExpression,
  'id' | 'sentence' | 'meaning' | 'keyword' | 'keywordMeaning' | 'level'
> & {
  streak: number;
};
