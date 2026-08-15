import { buildReviewOptions } from '@/learning/reviewPolicy';
import type { EnglishExpression } from '@/types/expression';

const expression = (id: number): EnglishExpression => ({
  id,
  sentence: `Sentence ${id}`,
  meaning: `뜻 ${id}`,
  keyword: `keyword ${id}`,
  keywordMeaning: `키워드 ${id}`,
  example: `Example ${id}`,
  exampleMeaning: `예문 ${id}`,
  level: 'B1',
  category: 'Daily'
});

describe('buildReviewOptions', () => {
  const published = Array.from({ length: 8 }, (_, index) => expression(index));

  it('정답 하나와 중복 없는 오답 세 개를 만든다', () => {
    const options = buildReviewOptions(published[2], 0, published.slice(0, 4), published);

    expect(options).toHaveLength(4);
    expect(new Set(options.map((item) => item.id)).size).toBe(4);
    expect(options.some((item) => item.id === published[2].id)).toBe(true);
  });

  it('같은 입력에는 같은 선택지 순서를 반환한다', () => {
    const first = buildReviewOptions(published[3], 2, published.slice(0, 5), published);
    const second = buildReviewOptions(published[3], 2, published.slice(0, 5), published);

    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
  });

  it('학습 표현이 적으면 게시 콘텐츠에서 선택지를 보충한다', () => {
    const options = buildReviewOptions(published[0], 1, [published[0]], published);

    expect(options).toHaveLength(4);
  });
});
