import { supabase } from '@/lib/supabase';

const DEFAULT_CATEGORY_ID = 'default';
const DEFAULT_CATEGORY_NAME = '기본';

export type SyncedSavedCategory = {
  id: string;
  name: string;
  createdAt: string;
};

export type CompletedHistoryEntry = {
  expressionId: number;
  completedDate: string;
};

export type LearningStateSnapshot = {
  currentExpressionId: number;
  completedExpressionIds: number[];
  completedHistory: CompletedHistoryEntry[];
  favoriteExpressionIds: number[];
  savedCategories: SyncedSavedCategory[];
  savedExpressionCategoryIds: Record<string, string[]>;
  wrongAnswerExpressionIds: number[];
  streak: number;
  longestStreak: number;
  totalCompleted: number;
  lastCompletedDate: string | null;
  isPremium: boolean;
};

export type ReviewQueueItem = {
  expressionId: number;
  isWrongNote: boolean;
  correctStreak: number;
};

export type ReviewAnswerResult = {
  wrongNoteStatus: 'active' | 'mastered' | 'none';
  correctStreak: number;
  mastered: boolean;
};

type ContentRow = {
  id: number;
  content_index: number | null;
};

type LearningLogRow = {
  content_index: number;
  completed_date: string;
};

type CategoryRow = {
  id: number;
  name: string;
  created_at: string;
};

type FavoriteRow = {
  id: number;
  content_id: number;
};

type FavoriteItemRow = {
  favorite_id: number;
  category_id: number;
};

type LearningDashboardRow = {
  current_content_index: number | null;
  streak: number;
  longest_streak: number;
  total_completed: number;
  last_completed_date: string | null;
};

type ReviewQueueRow = {
  content_index: number;
  is_wrong_note: boolean;
  correct_streak: number;
};

type ReviewAnswerRow = {
  wrong_note_status: string;
  correct_streak: number;
  mastered: boolean;
};

const throwIfError = (error: { message: string } | null) => {
  if (error) {
    throw new Error(error.message);
  }
};

const loadContentRows = async () => {
  const { data, error } = await supabase
    .from('contents')
    .select('id, content_index')
    .eq('status', 'published');

  throwIfError(error);
  return (data ?? []) as ContentRow[];
};

const buildContentMaps = (rows: ContentRow[]) => {
  const databaseIdByExpressionId = new Map<number, number>();
  const expressionIdByDatabaseId = new Map<number, number>();

  rows.forEach((row) => {
    if (row.content_index !== null) {
      databaseIdByExpressionId.set(row.content_index, row.id);
      expressionIdByDatabaseId.set(row.id, row.content_index);
    }
  });

  return { databaseIdByExpressionId, expressionIdByDatabaseId };
};

const requireContentDatabaseId = async (expressionId: number) => {
  const { data, error } = await supabase
    .from('contents')
    .select('id')
    .eq('status', 'published')
    .eq('content_index', expressionId)
    .maybeSingle();

  throwIfError(error);

  if (!data) {
    throw new Error(`문장 ${expressionId}에 대응하는 Supabase 콘텐츠가 없습니다.`);
  }

  return data.id as number;
};

const toLocalCategoryId = (category: CategoryRow) =>
  category.name === DEFAULT_CATEGORY_NAME ? DEFAULT_CATEGORY_ID : `cloud-category-${category.id}`;

const getCategoryName = (categoryId: string, categories: SyncedSavedCategory[]) => {
  const name = categories.find((category) => category.id === categoryId)?.name;

  if (!name) {
    throw new Error('저장 카테고리를 찾지 못했습니다. 다시 동기화해주세요.');
  }

  return name;
};

const ensureCategory = async (userId: string, categoryName: string) => {
  const { data, error } = await supabase
    .from('favorite_categories')
    .upsert(
      {
        user_id: userId,
        name: categoryName,
        sort_order: categoryName === DEFAULT_CATEGORY_NAME ? -100 : 0
      },
      { onConflict: 'user_id,name' }
    )
    .select('id, name, created_at')
    .single();

  throwIfError(error);

  if (!data) {
    throw new Error('Supabase 저장 카테고리를 만들지 못했습니다.');
  }

  return data as CategoryRow;
};

const ensureFavorite = async (userId: string, contentId: number) => {
  const { data, error } = await supabase
    .from('favorites')
    .upsert({ user_id: userId, content_id: contentId }, { onConflict: 'user_id,content_id' })
    .select('id')
    .single();

  throwIfError(error);

  if (!data) {
    throw new Error('Supabase 저장 문장을 만들지 못했습니다.');
  }

  return data.id as number;
};

export const loadCloudLearningState = async (userId: string): Promise<LearningStateSnapshot> => {
  const [
    contentResult,
    profileResult,
    dashboardResult,
    learningLogResult,
    categoryResult,
    favoriteResult,
    favoriteItemResult,
    wrongNoteResult
  ] = await Promise.all([
    supabase.from('contents').select('id, content_index').eq('status', 'published'),
    supabase.from('profiles').select('is_premium').eq('id', userId).maybeSingle(),
    supabase.rpc('get_learning_dashboard').maybeSingle(),
    supabase
      .from('learning_logs')
      .select('content_index, completed_date')
      .eq('user_id', userId)
      .order('completed_date', { ascending: false }),
    supabase
      .from('favorite_categories')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('sort_order')
      .order('created_at'),
    supabase.from('favorites').select('id, content_id').eq('user_id', userId),
    supabase.from('favorite_category_items').select('favorite_id, category_id'),
    supabase.from('wrong_notes').select('content_id').eq('user_id', userId).eq('status', 'active')
  ]);

  [
    contentResult,
    profileResult,
    dashboardResult,
    learningLogResult,
    categoryResult,
    favoriteResult,
    favoriteItemResult,
    wrongNoteResult
  ].forEach((result) => throwIfError(result.error));

  const { expressionIdByDatabaseId } = buildContentMaps((contentResult.data ?? []) as ContentRow[]);
  const categories = (categoryResult.data ?? []) as CategoryRow[];
  const favorites = (favoriteResult.data ?? []) as FavoriteRow[];
  const favoriteItems = (favoriteItemResult.data ?? []) as FavoriteItemRow[];
  const localCategoryIdByDatabaseId = new Map<number, string>();
  const savedCategories = categories.map((category) => {
    const id = toLocalCategoryId(category);
    localCategoryIdByDatabaseId.set(category.id, id);
    return { id, name: category.name, createdAt: category.created_at };
  });

  if (!savedCategories.some((category) => category.id === DEFAULT_CATEGORY_ID)) {
    savedCategories.unshift({
      id: DEFAULT_CATEGORY_ID,
      name: DEFAULT_CATEGORY_NAME,
      createdAt: '2026-01-01T00:00:00.000Z'
    });
  }

  const itemsByFavoriteId = new Map<number, string[]>();
  favoriteItems.forEach((item) => {
    const categoryId = localCategoryIdByDatabaseId.get(item.category_id);
    if (categoryId) {
      itemsByFavoriteId.set(item.favorite_id, [
        ...(itemsByFavoriteId.get(item.favorite_id) ?? []),
        categoryId
      ]);
    }
  });

  const savedExpressionCategoryIds: Record<string, string[]> = {};
  favorites.forEach((favorite) => {
    const expressionId = expressionIdByDatabaseId.get(favorite.content_id);
    if (expressionId !== undefined) {
      savedExpressionCategoryIds[String(expressionId)] =
        itemsByFavoriteId.get(favorite.id) ?? [DEFAULT_CATEGORY_ID];
    }
  });

  const dashboard = dashboardResult.data as LearningDashboardRow | null;
  const learningLogRows = (learningLogResult.data ?? []) as LearningLogRow[];

  return {
    currentExpressionId: Number(dashboard?.current_content_index ?? 0),
    completedExpressionIds: learningLogRows
      .map((log) => Number(log.content_index))
      .filter(Number.isFinite),
    // completed_date 내림차순(최신순)으로 정렬해서 받아온 순서를 그대로 보존한다 — "이전 문장" 목록이 최근 완료 순으로 보이도록.
    completedHistory: learningLogRows
      .map((log) => ({ expressionId: Number(log.content_index), completedDate: log.completed_date }))
      .filter((entry): entry is CompletedHistoryEntry => Number.isFinite(entry.expressionId)),
    favoriteExpressionIds: Object.keys(savedExpressionCategoryIds).map(Number),
    savedCategories,
    savedExpressionCategoryIds,
    wrongAnswerExpressionIds: (wrongNoteResult.data ?? [])
      .map((note) => expressionIdByDatabaseId.get(Number(note.content_id)))
      .filter((id): id is number => id !== undefined),
    streak: Number(dashboard?.streak ?? 0),
    longestStreak: Number(dashboard?.longest_streak ?? 0),
    totalCompleted: Number(dashboard?.total_completed ?? 0),
    lastCompletedDate: dashboard?.last_completed_date ?? null,
    isPremium: profileResult.data?.is_premium ?? false
  };
};

export const completeCurrentContent = async (expressionId: number) => {
  const contentId = await requireContentDatabaseId(expressionId);
  const { data, error } = await supabase.rpc('complete_current_content', {
    p_content_id: contentId
  });

  throwIfError(error);

  if (data !== true) {
    throw new Error('현재 학습 순서와 완료하려는 문장이 다릅니다. 다시 동기화해주세요.');
  }
};

export const createCloudCategory = async (userId: string, name: string) => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('카테고리 이름을 입력해주세요.');
  }

  const category = await ensureCategory(userId, trimmedName);
  return toLocalCategoryId(category);
};

export const saveContentToCategory = async (
  userId: string,
  expressionId: number,
  categoryId: string,
  categories: SyncedSavedCategory[]
) => {
  const [contentId, category] = await Promise.all([
    requireContentDatabaseId(expressionId),
    ensureCategory(userId, getCategoryName(categoryId, categories))
  ]);
  const favoriteId = await ensureFavorite(userId, contentId);
  const { error } = await supabase.from('favorite_category_items').upsert(
    { favorite_id: favoriteId, category_id: category.id },
    { onConflict: 'favorite_id,category_id', ignoreDuplicates: true }
  );

  throwIfError(error);
};

export const removeContentFromCategory = async (
  userId: string,
  expressionId: number,
  categoryId: string,
  categories: SyncedSavedCategory[]
) => {
  const contentId = await requireContentDatabaseId(expressionId);
  const categoryName = getCategoryName(categoryId, categories);
  const [{ data: category, error: categoryError }, { data: favorite, error: favoriteError }] =
    await Promise.all([
      supabase
        .from('favorite_categories')
        .select('id')
        .eq('user_id', userId)
        .eq('name', categoryName)
        .maybeSingle(),
      supabase
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .maybeSingle()
    ]);

  throwIfError(categoryError);
  throwIfError(favoriteError);

  if (!favorite) {
    return;
  }

  if (category) {
    const { error } = await supabase
      .from('favorite_category_items')
      .delete()
      .eq('favorite_id', favorite.id)
      .eq('category_id', category.id);
    throwIfError(error);
  }

  const { data: remainingItems, error: remainingError } = await supabase
    .from('favorite_category_items')
    .select('favorite_id')
    .eq('favorite_id', favorite.id)
    .limit(1);
  throwIfError(remainingError);

  if ((remainingItems ?? []).length === 0) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('id', favorite.id);
    throwIfError(error);
  }
};

export const loadReviewQueue = async (): Promise<ReviewQueueItem[]> => {
  const { data, error } = await supabase.rpc('get_review_queue', { p_limit: 5 });
  throwIfError(error);

  return ((data ?? []) as ReviewQueueRow[]).map((row) => ({
    expressionId: Number(row.content_index),
    isWrongNote: Boolean(row.is_wrong_note),
    correctStreak: Number(row.correct_streak ?? 0)
  }));
};

// Resolve all four choices in one request while the question is on screen.
export const prepareReviewAnswerIds = async (expressionIds: number[]) => {
  const { data, error } = await supabase.from('contents')
    .select('id, content_index').eq('status', 'published')
    .in('content_index', [...new Set(expressionIds)]);
  throwIfError(error);
  return buildContentMaps((data ?? []) as ContentRow[]).databaseIdByExpressionId;
};

export const submitReviewAnswer = async (
  expressionId: number,
  selectedExpressionId: number,
  isCorrect: boolean,
  preparedIds?: Map<number, number>
): Promise<ReviewAnswerResult> => {
  const [contentId, selectedContentId] = await Promise.all([
    preparedIds?.get(expressionId) ?? requireContentDatabaseId(expressionId),
    preparedIds?.get(selectedExpressionId) ?? requireContentDatabaseId(selectedExpressionId)
  ]);
  const { data, error } = await supabase
    .rpc('record_review_answer', {
      p_content_id: contentId,
      p_selected_content_id: selectedContentId,
      p_is_correct: isCorrect
    })
    .maybeSingle();

  throwIfError(error);

  const result = data as ReviewAnswerRow | null;

  return {
    wrongNoteStatus: (result?.wrong_note_status ?? 'none') as ReviewAnswerResult['wrongNoteStatus'],
    correctStreak: Number(result?.correct_streak ?? 0),
    mastered: Boolean(result?.mastered)
  };
};

export const deleteCurrentAccount = async () => {
  const { data, error } = await supabase.functions.invoke<{ deleted?: boolean }>('delete-account', {
    method: 'POST'
  });

  if (error) {
    throw error;
  }

  if (!data?.deleted) {
    throw new Error('회원탈퇴 응답을 확인하지 못했습니다.');
  }
};
