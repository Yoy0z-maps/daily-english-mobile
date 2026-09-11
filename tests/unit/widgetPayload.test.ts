import { createWidgetPayload } from '@/widget/createWidgetPayload';
import { mockExpressions } from '@/data/mockExpressions';

const current = mockExpressions[0];
const next = mockExpressions[1];

describe('widget schedule payload', () => {
  it('keeps an unfinished lesson without scheduling an advance', () => {
    expect(createWidgetPayload(current, 2)).not.toHaveProperty('nextExpression');
  });

  it('stores the next lesson with the completion day for native midnight selection', () => {
    const payload = createWidgetPayload(current, 3, {
      nextExpression: next,
      lastCompletedDate: '2026-09-11'
    });
    expect(payload.id).toBe(current.id);
    expect(payload.nextExpression?.id).toBe(next.id);
    expect(payload.advanceAfterDate).toBe('2026-09-11');
    expect(payload.lastCompletedDate).toBe('2026-09-11');
  });

  it('does not advance without completion or beyond the available content', () => {
    expect(createWidgetPayload(current, 0, { nextExpression: next })).not.toHaveProperty('advanceAfterDate');
    expect(createWidgetPayload(current, 3, { lastCompletedDate: '2026-09-11' })).not.toHaveProperty('nextExpression');
  });
});
