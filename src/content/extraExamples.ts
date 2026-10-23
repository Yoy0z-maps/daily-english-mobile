import { starterExtraExamples } from '@/data/extraExamples';
import type { EnglishExpression } from '@/types/expression';

const normalize = (value: string) =>
  value.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();

export const getExtraExamples = (expression: EnglishExpression) => {
  const seen = new Set([normalize(expression.sentence), normalize(expression.example)]);
  return [
    ...(expression.extraExamples ?? []),
    ...(starterExtraExamples[expression.keyword.trim().toLowerCase()] ?? []),
  ].filter((item) => {
    const sentence = normalize(item.sentence);
    if (!sentence || !item.meaning.trim() || seen.has(sentence)) return false;
    // Reject the old placeholder even if it was persisted in content.
    if (sentence === normalize(`${expression.sentence} I'll keep you posted.`)) return false;
    seen.add(sentence);
    return true;
  }).slice(0, 2);
};
