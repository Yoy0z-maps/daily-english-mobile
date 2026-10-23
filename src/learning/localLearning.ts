import * as Crypto from 'expo-crypto';

import {
  DEFAULT_SAVED_CATEGORY_ID,
  getLocalDateKey,
  type AppStore,
  type LocalWrongNote,
  useAppStore
} from '@/store/useAppStore';
import type { ReviewAnswerResult, ReviewQueueItem } from '@/sync/learningSync';

// 로그인하지 않은 사용자의 학습 규칙. Supabase의 complete_current_content,
// get_review_queue, record_review_answer와 같은 결과가 나오도록 기기 안에서 계산한다.

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_LIMIT = 5;
const MASTERY_STREAK = 2;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

export const hasLocalLearningData = (state: AppStore) =>
  state.completedHistory.length > 0 ||
  Object.keys(state.savedExpressionCategoryIds).length > 0 ||
  state.savedCategories.some((category) => category.id !== DEFAULT_SAVED_CATEGORY_ID) ||
  Object.keys(state.localWrongNotes).length > 0;

// 날짜가 바뀌면 서버 대시보드처럼 끊긴 스트릭을 0으로 만들고, 어제 완료한 문장 다음으로 넘어간다.
export const normalizeLocalLearningState = () => {
  const state = useAppStore.getState();
  const todayKey = getLocalDateKey();
  const yesterdayKey = getLocalDateKey(addDays(new Date(), -1));
  const patch: Partial<AppStore> = {};

  if (state.lastCompletedDate && state.lastCompletedDate < yesterdayKey && state.streak !== 0) {
    patch.streak = 0;
  }

  if (
    state.lastCompletedDate !== todayKey &&
    state.completedExpressionIds.includes(state.currentExpressionId)
  ) {
    patch.currentExpressionId = state.currentExpressionId + 1;
  }

  if (Object.keys(patch).length > 0) {
    useAppStore.setState(patch);
  }
};

// 오늘 이미 완료했거나 날짜가 바뀌어 다른 문장이 오늘의 문장이 됐다면 false를 돌려준다.
export const completeLocalContent = (expressionId: number) => {
  normalizeLocalLearningState();
  const state = useAppStore.getState();

  if (
    state.lastCompletedDate === getLocalDateKey() ||
    state.completedExpressionIds.includes(expressionId)
  ) {
    return false;
  }

  state.applyOptimisticCompletion(expressionId);
  useAppStore.setState({ currentExpressionId: expressionId });
  return true;
};

export const createLocalCategory = (rawName: string, expressionId?: number) => {
  const name = rawName.trim();
  if (!name) throw new Error('카테고리 이름을 입력해주세요.');

  const state = useAppStore.getState();
  const existing = state.savedCategories.find((category) => category.name === name);
  const category = existing ?? {
    id: `local-category-${Crypto.randomUUID()}`,
    name,
    createdAt: new Date().toISOString()
  };

  if (!existing) {
    useAppStore.setState({ savedCategories: [...state.savedCategories, category] });
  }

  if (
    expressionId !== undefined &&
    !state.savedExpressionCategoryIds[String(expressionId)]?.includes(category.id)
  ) {
    useAppStore.getState().applyOptimisticCategoryToggle(expressionId, category.id);
  }

  return category.id;
};

export const setLocalCategoryMembership = (
  expressionId: number,
  categoryId: string,
  shouldSave: boolean
) => {
  const state = useAppStore.getState();
  const isSaved = state.savedExpressionCategoryIds[String(expressionId)]?.includes(categoryId) ?? false;

  if (isSaved !== shouldSave) {
    state.applyOptimisticCategoryToggle(expressionId, categoryId);
  }
};

export const loadLocalReviewQueue = (publishedExpressionIds: number[]): ReviewQueueItem[] => {
  const state = useAppStore.getState();
  const published = new Set(publishedExpressionIds);

  return [...new Set(state.completedExpressionIds)]
    .filter((expressionId) => published.has(expressionId))
    .map((expressionId) => {
      const note = state.localWrongNotes[String(expressionId)];
      const isWrongNote = note?.status === 'active';
      return {
        expressionId,
        isWrongNote,
        correctStreak: isWrongNote ? note.correctStreak : 0,
        nextReviewAt: isWrongNote ? note.nextReviewAt : null,
        randomOrder: Math.random()
      };
    })
    .sort((a, b) => {
      if (a.isWrongNote !== b.isWrongNote) return a.isWrongNote ? -1 : 1;
      if (a.nextReviewAt !== b.nextReviewAt) {
        if (a.nextReviewAt === null) return 1;
        if (b.nextReviewAt === null) return -1;
        return a.nextReviewAt < b.nextReviewAt ? -1 : 1;
      }
      return a.randomOrder - b.randomOrder;
    })
    .slice(0, REVIEW_LIMIT)
    .map(({ expressionId, isWrongNote, correctStreak }) => ({ expressionId, isWrongNote, correctStreak }));
};

export const recordLocalReviewAnswer = (
  expressionId: number,
  isCorrect: boolean
): ReviewAnswerResult => {
  const state = useAppStore.getState();
  const key = String(expressionId);
  const now = new Date();
  const current = state.localWrongNotes[key];
  let next: LocalWrongNote | undefined = current;

  if (isCorrect) {
    if (current) {
      const correctStreak = current.correctStreak + 1;
      const mastered = correctStreak >= MASTERY_STREAK;
      next = {
        ...current,
        correctStreak,
        status: mastered ? 'mastered' : 'active',
        nextReviewAt: mastered ? null : addDays(now, 3).toISOString()
      };
    }
  } else {
    next = {
      wrongCount: (current?.wrongCount ?? 0) + 1,
      correctStreak: 0,
      status: 'active',
      lastWrongAt: now.toISOString(),
      nextReviewAt: addDays(now, 1).toISOString()
    };
  }

  if (next) {
    const localWrongNotes = { ...state.localWrongNotes, [key]: next };
    useAppStore.setState({
      localWrongNotes,
      wrongAnswerExpressionIds: Object.entries(localWrongNotes)
        .filter(([, note]) => note.status === 'active')
        .map(([id]) => Number(id))
    });
  }

  return {
    wrongNoteStatus: next?.status ?? 'none',
    correctStreak: next?.correctStreak ?? 0,
    mastered: next?.status === 'mastered'
  };
};

export type GuestLearningImport = {
  completions: { content_index: number; completed_date: string }[];
  categories: string[];
  saved: { content_index: number; categories: string[] }[];
  wrong_notes: {
    content_index: number;
    wrong_count: number;
    correct_streak: number;
    status: LocalWrongNote['status'];
    last_wrong_at: string;
    next_review_at: string | null;
  }[];
};

// 로그인 직후 서버의 import_guest_learning_state RPC로 보낼 게스트 학습 기록.
export const buildGuestImportPayload = (state: AppStore): GuestLearningImport => {
  const categoryNameById = new Map(state.savedCategories.map((category) => [category.id, category.name]));

  return {
    completions: state.completedHistory.map((entry) => ({
      content_index: entry.expressionId,
      completed_date: entry.completedDate
    })),
    categories: state.savedCategories.map((category) => category.name),
    saved: Object.entries(state.savedExpressionCategoryIds).map(([expressionId, categoryIds]) => ({
      content_index: Number(expressionId),
      categories: categoryIds.flatMap((id) => {
        const name = categoryNameById.get(id);
        return name ? [name] : [];
      })
    })),
    wrong_notes: Object.entries(state.localWrongNotes).map(([expressionId, note]) => ({
      content_index: Number(expressionId),
      wrong_count: note.wrongCount,
      correct_streak: note.correctStreak,
      status: note.status,
      last_wrong_at: note.lastWrongAt,
      next_review_at: note.nextReviewAt
    }))
  };
};
