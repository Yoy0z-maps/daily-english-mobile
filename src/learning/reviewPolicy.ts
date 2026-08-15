import type { EnglishExpression } from '@/types/expression';

const deterministicRank = (expressionId: number, questionIndex: number, salt: number) =>
  ((expressionId + salt) * (questionIndex + salt + 3)) % 997;

export const buildReviewOptions = (
  correct: EnglishExpression,
  questionIndex: number,
  learnedExpressions: EnglishExpression[],
  publishedExpressions: EnglishExpression[]
) => {
  const candidates = new Map<number, EnglishExpression>();

  [...learnedExpressions, ...publishedExpressions].forEach((expression) => {
    if (expression.id !== correct.id) {
      candidates.set(expression.id, expression);
    }
  });

  const distractors = Array.from(candidates.values())
    .sort(
      (a, b) =>
        deterministicRank(a.id, questionIndex, 5) -
          deterministicRank(b.id, questionIndex, 5) || a.id - b.id
    )
    .slice(0, 3);

  return [correct, ...distractors].sort(
    (a, b) =>
      deterministicRank(a.id, questionIndex, 11) -
        deterministicRank(b.id, questionIndex, 11) || a.id - b.id
  );
};
