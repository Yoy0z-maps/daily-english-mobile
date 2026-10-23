import {
  buildGuestImportPayload,
  completeLocalContent,
  createLocalCategory,
  hasLocalLearningData,
  loadLocalReviewQueue,
  normalizeLocalLearningState,
  recordLocalReviewAnswer,
  setLocalCategoryMembership
} from '@/learning/localLearning';
import { DEFAULT_SAVED_CATEGORY_ID, getLocalDateKey, useAppStore } from '@/store/useAppStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));

const daysAgo = (days: number) => getLocalDateKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

describe('local learning (guest mode)', () => {
  beforeEach(() => {
    useAppStore.getState().clearUserSession();
  });

  it('completes today\'s content once and keeps it as today\'s content', () => {
    expect(completeLocalContent(0)).toBe(true);
    expect(completeLocalContent(0)).toBe(false);

    expect(useAppStore.getState()).toMatchObject({
      currentExpressionId: 0,
      completedExpressionIds: [0],
      totalCompleted: 1,
      streak: 1,
      lastCompletedDate: getLocalDateKey()
    });
  });

  it('moves to the next content on a new day and continues the streak', () => {
    useAppStore.setState({
      currentExpressionId: 3,
      completedExpressionIds: [3],
      completedHistory: [{ expressionId: 3, completedDate: daysAgo(1) }],
      lastCompletedDate: daysAgo(1),
      streak: 4,
      longestStreak: 4,
      totalCompleted: 4
    });

    normalizeLocalLearningState();
    expect(useAppStore.getState().currentExpressionId).toBe(4);
    expect(useAppStore.getState().streak).toBe(4);

    expect(completeLocalContent(4)).toBe(true);
    expect(useAppStore.getState()).toMatchObject({ streak: 5, longestStreak: 5, totalCompleted: 5 });
  });

  it('expires the streak after a missed day', () => {
    useAppStore.setState({
      currentExpressionId: 1,
      completedExpressionIds: [1],
      lastCompletedDate: daysAgo(3),
      streak: 7,
      longestStreak: 7
    });

    normalizeLocalLearningState();
    expect(useAppStore.getState()).toMatchObject({ streak: 0, longestStreak: 7, currentExpressionId: 2 });
  });

  it('masters a wrong note after two correct answers in a row', () => {
    useAppStore.setState({ completedExpressionIds: [1, 2] });

    expect(recordLocalReviewAnswer(1, false)).toEqual({
      wrongNoteStatus: 'active', correctStreak: 0, mastered: false
    });
    expect(useAppStore.getState().wrongAnswerExpressionIds).toEqual([1]);
    expect(loadLocalReviewQueue([1, 2])[0]).toEqual({ expressionId: 1, isWrongNote: true, correctStreak: 0 });

    recordLocalReviewAnswer(1, true);
    expect(recordLocalReviewAnswer(1, true)).toEqual({
      wrongNoteStatus: 'mastered', correctStreak: 2, mastered: true
    });
    expect(useAppStore.getState().wrongAnswerExpressionIds).toEqual([]);
  });

  it('only reviews completed, published content', () => {
    useAppStore.setState({ completedExpressionIds: [1, 2, 3] });
    expect(loadLocalReviewQueue([1, 3]).map((item) => item.expressionId).sort()).toEqual([1, 3]);
  });

  it('builds an import payload keyed by category names', () => {
    expect(hasLocalLearningData(useAppStore.getState())).toBe(false);

    const travelId = createLocalCategory('여행', 5);
    setLocalCategoryMembership(5, DEFAULT_SAVED_CATEGORY_ID, true);
    completeLocalContent(0);

    const state = useAppStore.getState();
    expect(hasLocalLearningData(state)).toBe(true);
    expect(travelId).toBe('local-category-uuid-1');
    expect(buildGuestImportPayload(state)).toEqual({
      completions: [{ content_index: 0, completed_date: getLocalDateKey() }],
      categories: ['기본', '여행'],
      saved: [{ content_index: 5, categories: ['여행', '기본'] }],
      wrong_notes: []
    });
  });
});
