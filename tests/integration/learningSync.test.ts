jest.mock('@/lib/supabase', () => {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn()
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return {
    supabase: {
      from: jest.fn(() => query),
      rpc: jest.fn(),
      __query: query
    }
  };
});

import { supabase } from '@/lib/supabase';
import { completeCurrentContent, loadReviewQueue } from '@/sync/learningSync';

type MockSupabase = typeof supabase & {
  __query: {
    maybeSingle: jest.Mock;
  };
};

const mockSupabase = supabase as MockSupabase;

describe('learningSync Supabase contract', () => {
  it('서버가 반환한 오답 우선 복습 큐를 앱 모델로 변환한다', async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: [
        { content_index: 4, is_wrong_note: true, correct_streak: 1 },
        { content_index: 2, is_wrong_note: false, correct_streak: 0 }
      ],
      error: null
    });

    await expect(loadReviewQueue()).resolves.toEqual([
      { expressionId: 4, isWrongNote: true, correctStreak: 1 },
      { expressionId: 2, isWrongNote: false, correctStreak: 0 }
    ]);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_review_queue', { p_limit: 5 });
  });

  it('오늘 문장의 DB id로 학습 완료 RPC를 호출한다', async () => {
    mockSupabase.__query.maybeSingle.mockResolvedValueOnce({ data: { id: 91 }, error: null });
    (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });

    await expect(completeCurrentContent(7)).resolves.toBeUndefined();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('complete_current_content', {
      p_content_id: 91
    });
  });

  it('서버가 현재 학습 순서를 거부하면 오류를 반환한다', async () => {
    mockSupabase.__query.maybeSingle.mockResolvedValueOnce({ data: { id: 92 }, error: null });
    (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false, error: null });

    await expect(completeCurrentContent(8)).rejects.toThrow('현재 학습 순서');
  });
});
