import updates from '../../supabase/content/20261023-extra-examples.json';
import before from '../../supabase/content/20261023-extra-examples-before.json';
import { getExtraExamples } from '@/content/extraExamples';
import type { EnglishExpression } from '@/types/expression';

const normalize = (value: string) => value.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();

it('covers all 100 audited expressions exactly once', () => {
  expect(updates.map((row) => row.content_index)).toEqual(Array.from({ length: 100 }, (_, i) => i));
});

it.each(updates)('replaces examples for $keyword with two distinct translated sentences', (row) => {
  expect(row.extra_examples).toHaveLength(2);
  const old = before.find((item) => item.content_index === row.content_index)!;
  expect(new Set([row.sentence, ...row.extra_examples.map((x) => x.sentence)].map(normalize)).size).toBe(3);
  for (const item of row.extra_examples) {
    expect(item.meaning.trim().length).toBeGreaterThan(1);
    expect(old.extra_examples.map((x) => normalize(x.sentence))).not.toContain(normalize(item.sentence));
  }
  const expression = { sentence: row.sentence, example: 'Previously displayed example.', keyword: row.keyword, extraExamples: row.extra_examples } as EnglishExpression;
  expect(getExtraExamples(expression)).toEqual(row.extra_examples);
});
