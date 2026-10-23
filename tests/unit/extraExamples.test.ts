import { getExtraExamples } from '@/content/extraExamples';
import { mockExpressions } from '@/data/mockExpressions';

it.each(mockExpressions)('provides two distinct new examples for $keyword', (expression) => {
  const examples = getExtraExamples(expression);
  expect(examples).toHaveLength(2);
  expect(new Set(examples.map((item) => item.sentence)).size).toBe(2);
  for (const item of examples) {
    expect(item.sentence).not.toBe(expression.sentence);
    expect(item.sentence).not.toBe(expression.example);
    expect(item.sentence).not.toContain("I'll keep you posted.");
    expect(item.meaning.trim()).not.toBe('');
  }
});

it('uses the two supplied examples without prepending the card example', () => {
  const extraExamples = [
    { sentence: 'The design is ready for review.', meaning: '디자인 검토 준비가 됐어요.' },
    { sentence: 'Is the report ready for review?', meaning: '보고서를 검토할 준비가 됐나요?' },
  ];
  expect(getExtraExamples({ ...mockExpressions[18], extraExamples })).toEqual(extraExamples);
});

it('replaces repeated examples and the old placeholder with curated examples', () => {
  const expression = mockExpressions[18];
  expect(getExtraExamples({ ...expression, extraExamples: [
    { sentence: expression.example.toUpperCase(), meaning: expression.exampleMeaning },
    { sentence: `${expression.sentence} I'll keep you posted.`, meaning: '진행 상황을 알려드릴게요.' },
  ] })).toEqual(getExtraExamples(expression));
});

it('does not fabricate examples for unknown legacy content', () => {
  expect(getExtraExamples({ ...mockExpressions[0], keyword: 'unknown expression' })).toEqual([]);
});

it('deduplicates supplied examples and fills the second slot', () => {
  const item = { sentence: 'The design is ready for review.', meaning: '디자인 검토 준비가 됐어요.' };
  const result = getExtraExamples({ ...mockExpressions[18], extraExamples: [item, item] });
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual(item);
  expect(result[1].sentence).not.toEqual(item.sentence);
});
