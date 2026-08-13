import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const OPERATION_QUEUE_KEY = 'daily-english-learning-operation-queue-v1';
const DEFAULT_CATEGORY_ID = 'default';
const DEFAULT_CATEGORY_NAME = '기본';

export type SyncedSavedCategory = {
  id: string;
  name: string;
  createdAt: string;
};

export type LearningStateSnapshot = {
  currentExpressionId: number;
  completedExpressionIds: number[];
  favoriteExpressionIds: number[];
  savedCategories: SyncedSavedCategory[];
  savedExpressionCategoryIds: Record<string, string[]>;
  wrongAnswerExpressionIds: number[];
  streak: number;
  lastCompletedDate: string | null;
  isPremium: boolean;
};

export type LearningOperationInput =
  | { type: 'complete_content'; expressionId: number }
  | { type: 'create_category'; categoryName: string }
  | { type: 'save_to_category'; expressionId: number; categoryName: string }
  | { type: 'remove_from_category'; expressionId: number; categoryName: string }
  | {
      type: 'record_review';
      expressionId: number;
      selectedExpressionId: number | null;
      isCorrect: boolean;
    }
  | { type: 'remove_wrong_note'; expressionId: number }
  | { type: 'clear_wrong_notes' };

type PendingLearningOperation = LearningOperationInput & {
  id: string;
  userId: string;
  createdAt: string;
};

type ContentRow = {
  id: number;
  content_index: number | null;
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
  id: number;
  favorite_id: number;
  category_id: number;
};

let queueLock: Promise<unknown> = Promise.resolve();
let operationSequence = 0;

const withQueueLock = <T>(task: () => Promise<T>) => {
  const result = queueLock.then(task, task);
  queueLock = result.then(
    () => undefined,
    () => undefined
  );
  return result;
};

const throwIfError = (error: { message: string } | null) => {
  if (error) {
    throw new Error(error.message);
  }
};

const readOperationQueue = async () => {
  const savedQueue = await AsyncStorage.getItem(OPERATION_QUEUE_KEY);

  if (!savedQueue) {
    return [] as PendingLearningOperation[];
  }

  try {
    const parsed = JSON.parse(savedQueue);
    return Array.isArray(parsed) ? (parsed as PendingLearningOperation[]) : [];
  } catch {
    return [] as PendingLearningOperation[];
  }
};

const writeOperationQueue = async (queue: PendingLearningOperation[]) => {
  if (queue.length === 0) {
    await AsyncStorage.removeItem(OPERATION_QUEUE_KEY);
    return;
  }

  await AsyncStorage.setItem(OPERATION_QUEUE_KEY, JSON.stringify(queue));
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
    if (row.content_index === null) {
      return;
    }

    databaseIdByExpressionId.set(row.content_index, row.id);
    expressionIdByDatabaseId.set(row.id, row.content_index);
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
    .select('id')
    .single();

  throwIfError(error);

  if (!data) {
    throw new Error('Supabase 저장 카테고리를 만들지 못했습니다.');
  }

  return data.id as number;
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

const executeLearningOperation = async (operation: PendingLearningOperation) => {
  switch (operation.type) {
    case 'complete_content': {
      const contentId = await requireContentDatabaseId(operation.expressionId);
      const { data, error } = await supabase.rpc('complete_current_content', {
        p_content_id: contentId
      });

      throwIfError(error);

      if (data !== true) {
        console.warn('현재 학습 순서와 완료하려는 문장이 달라 완료 요청을 건너뜁니다.');
      }
      return;
    }
    case 'create_category': {
      await ensureCategory(operation.userId, operation.categoryName);
      return;
    }
    case 'save_to_category': {
      const contentId = await requireContentDatabaseId(operation.expressionId);
      const [categoryId, favoriteId] = await Promise.all([
        ensureCategory(operation.userId, operation.categoryName),
        ensureFavorite(operation.userId, contentId)
      ]);
      const { error } = await supabase
        .from('favorite_category_items')
        .upsert(
          { favorite_id: favoriteId, category_id: categoryId },
          { onConflict: 'favorite_id,category_id', ignoreDuplicates: true }
        );

      throwIfError(error);
      return;
    }
    case 'remove_from_category': {
      const contentId = await requireContentDatabaseId(operation.expressionId);
      const [{ data: category, error: categoryError }, { data: favorite, error: favoriteError }] =
        await Promise.all([
          supabase
            .from('favorite_categories')
            .select('id')
            .eq('user_id', operation.userId)
            .eq('name', operation.categoryName)
            .maybeSingle(),
          supabase
            .from('favorites')
            .select('id')
            .eq('user_id', operation.userId)
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

      const { data: remainingItems, error: remainingItemsError } = await supabase
        .from('favorite_category_items')
        .select('id')
        .eq('favorite_id', favorite.id)
        .limit(1);

      throwIfError(remainingItemsError);

      if ((remainingItems ?? []).length === 0) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', operation.userId)
          .eq('id', favorite.id);
        throwIfError(error);
      }
      return;
    }
    case 'record_review': {
      const contentId = await requireContentDatabaseId(operation.expressionId);
      const selectedContentId =
        operation.selectedExpressionId === null
          ? null
          : await requireContentDatabaseId(operation.selectedExpressionId);
      const { error } = await supabase.from('review_attempts').insert({
        user_id: operation.userId,
        content_id: contentId,
        selected_content_id: selectedContentId,
        is_correct: operation.isCorrect,
        answered_at: operation.createdAt
      });

      throwIfError(error);

      if (operation.isCorrect) {
        const { error: deleteError } = await supabase
          .from('wrong_notes')
          .delete()
          .eq('user_id', operation.userId)
          .eq('content_id', contentId);
        throwIfError(deleteError);
      }
      return;
    }
    case 'remove_wrong_note': {
      const contentId = await requireContentDatabaseId(operation.expressionId);
      const { error } = await supabase
        .from('wrong_notes')
        .delete()
        .eq('user_id', operation.userId)
        .eq('content_id', contentId);
      throwIfError(error);
      return;
    }
    case 'clear_wrong_notes': {
      const { error } = await supabase.from('wrong_notes').delete().eq('user_id', operation.userId);
      throwIfError(error);
    }
  }
};

export const enqueueLearningOperation = async (input: LearningOperationInput) => {
  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return;
    }

    const operation: PendingLearningOperation = {
      ...input,
      id: `${Date.now()}-${operationSequence++}`,
      userId: session.user.id,
      createdAt: new Date().toISOString()
    };

    await withQueueLock(async () => {
      const queue = await readOperationQueue();
      await writeOperationQueue([...queue, operation]);
    });

    await flushPendingLearningOperations(session.user.id);
  } catch (error) {
    console.warn('학습 변경 사항을 동기화 대기열에 저장하지 못했습니다.', error);
  }
};

export const flushPendingLearningOperations = async (userId: string) =>
  withQueueLock(async () => {
    const queue = await readOperationQueue();
    const remaining: PendingLearningOperation[] = [];
    let firstError: unknown = null;

    for (let index = 0; index < queue.length; index += 1) {
      const operation = queue[index];

      if (operation.userId !== userId || firstError) {
        remaining.push(operation);
        continue;
      }

      try {
        await executeLearningOperation(operation);
      } catch (error) {
        firstError = error;
        remaining.push(operation, ...queue.slice(index + 1));
        break;
      }
    }

    await writeOperationQueue(remaining);

    if (firstError) {
      throw firstError;
    }
  });

export const loadCloudLearningState = async (userId: string): Promise<LearningStateSnapshot> => {
  const [
    contentResult,
    profileResult,
    progressResult,
    learningLogResult,
    categoryResult,
    favoriteResult,
    favoriteItemResult,
    wrongNoteResult,
    currentContentResult
  ] = await Promise.all([
    supabase.from('contents').select('id, content_index').eq('status', 'published'),
    supabase.from('profiles').select('is_premium').eq('id', userId).maybeSingle(),
    supabase
      .from('user_progress')
      .select('streak, last_completed_date')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('learning_logs')
      .select('content_index, completed_date')
      .eq('user_id', userId)
      .order('completed_date'),
    supabase
      .from('favorite_categories')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('sort_order')
      .order('created_at'),
    supabase.from('favorites').select('id, content_id').eq('user_id', userId),
    supabase.from('favorite_category_items').select('id, favorite_id, category_id'),
    supabase.from('wrong_notes').select('content_id').eq('user_id', userId).eq('status', 'active'),
    supabase.rpc('get_current_content_id')
  ]);

  [
    contentResult,
    profileResult,
    progressResult,
    learningLogResult,
    categoryResult,
    favoriteResult,
    favoriteItemResult,
    wrongNoteResult,
    currentContentResult
  ].forEach((result) => throwIfError(result.error));

  const { expressionIdByDatabaseId } = buildContentMaps((contentResult.data ?? []) as ContentRow[]);
  const categories = (categoryResult.data ?? []) as CategoryRow[];
  const favorites = (favoriteResult.data ?? []) as FavoriteRow[];
  const favoriteItems = (favoriteItemResult.data ?? []) as FavoriteItemRow[];
  const localCategoryIdByDatabaseId = new Map<number, string>();
  const savedCategories: SyncedSavedCategory[] = [];

  categories.forEach((category) => {
    const localId = category.name === DEFAULT_CATEGORY_NAME ? DEFAULT_CATEGORY_ID : `cloud-category-${category.id}`;
    localCategoryIdByDatabaseId.set(category.id, localId);
    savedCategories.push({ id: localId, name: category.name, createdAt: category.created_at });
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

    if (!categoryId) {
      return;
    }

    itemsByFavoriteId.set(item.favorite_id, [
      ...(itemsByFavoriteId.get(item.favorite_id) ?? []),
      categoryId
    ]);
  });

  const savedExpressionCategoryIds: Record<string, string[]> = {};
  favorites.forEach((favorite) => {
    const expressionId = expressionIdByDatabaseId.get(favorite.content_id);

    if (expressionId === undefined) {
      return;
    }

    savedExpressionCategoryIds[String(expressionId)] =
      itemsByFavoriteId.get(favorite.id) ?? [DEFAULT_CATEGORY_ID];
  });

  const currentContentDatabaseId = Number(currentContentResult.data);
  const currentExpressionId = Number.isFinite(currentContentDatabaseId)
    ? expressionIdByDatabaseId.get(currentContentDatabaseId) ?? 0
    : 0;

  return {
    currentExpressionId,
    completedExpressionIds: (learningLogResult.data ?? [])
      .map((log) => log.content_index as number)
      .filter((id) => Number.isFinite(id)),
    favoriteExpressionIds: Object.keys(savedExpressionCategoryIds).map(Number),
    savedCategories,
    savedExpressionCategoryIds,
    wrongAnswerExpressionIds: (wrongNoteResult.data ?? [])
      .map((note) => expressionIdByDatabaseId.get(note.content_id as number))
      .filter((id): id is number => id !== undefined),
    streak: progressResult.data?.streak ?? 0,
    lastCompletedDate: progressResult.data?.last_completed_date ?? null,
    isPremium: profileResult.data?.is_premium ?? false
  };
};

const uniqueNumbers = (values: number[]) => Array.from(new Set(values.filter(Number.isFinite)));
const uniqueStrings = (values: string[]) => Array.from(new Set(values));

export const mergeLearningStates = (
  local: LearningStateSnapshot,
  cloud: LearningStateSnapshot
): LearningStateSnapshot => {
  const mergedCategories: SyncedSavedCategory[] = [];
  const mergedCategoryIdByName = new Map<string, string>();

  [...cloud.savedCategories, ...local.savedCategories].forEach((category) => {
    if (mergedCategoryIdByName.has(category.name)) {
      return;
    }

    const id = category.name === DEFAULT_CATEGORY_NAME ? DEFAULT_CATEGORY_ID : category.id;
    mergedCategoryIdByName.set(category.name, id);
    mergedCategories.push({ ...category, id });
  });

  const addSavedMap = (
    source: LearningStateSnapshot,
    target: Record<string, string[]>
  ) => {
    const categoryNameById = new Map(source.savedCategories.map((category) => [category.id, category.name]));

    Object.entries(source.savedExpressionCategoryIds).forEach(([expressionId, categoryIds]) => {
      const mappedIds = categoryIds
        .map((categoryId) => categoryNameById.get(categoryId))
        .map((name) => (name ? mergedCategoryIdByName.get(name) : undefined))
        .filter((id): id is string => id !== undefined);
      target[expressionId] = uniqueStrings([...(target[expressionId] ?? []), ...mappedIds]);
    });
  };

  const savedExpressionCategoryIds: Record<string, string[]> = {};
  addSavedMap(cloud, savedExpressionCategoryIds);
  addSavedMap(local, savedExpressionCategoryIds);

  uniqueNumbers([...cloud.favoriteExpressionIds, ...local.favoriteExpressionIds]).forEach((expressionId) => {
    const key = String(expressionId);
    if (!savedExpressionCategoryIds[key] || savedExpressionCategoryIds[key].length === 0) {
      savedExpressionCategoryIds[key] = [DEFAULT_CATEGORY_ID];
    }
  });

  const cloudDate = cloud.lastCompletedDate ?? '';
  const localDate = local.lastCompletedDate ?? '';

  return {
    currentExpressionId: cloud.currentExpressionId,
    completedExpressionIds: uniqueNumbers([
      ...cloud.completedExpressionIds,
      ...local.completedExpressionIds
    ]),
    favoriteExpressionIds: Object.keys(savedExpressionCategoryIds).map(Number).filter(Number.isFinite),
    savedCategories: mergedCategories,
    savedExpressionCategoryIds,
    wrongAnswerExpressionIds: uniqueNumbers([
      ...cloud.wrongAnswerExpressionIds,
      ...local.wrongAnswerExpressionIds
    ]),
    streak:
      cloudDate > localDate
        ? cloud.streak
        : localDate > cloudDate
          ? local.streak
          : Math.max(cloud.streak, local.streak),
    lastCompletedDate: cloudDate > localDate ? cloud.lastCompletedDate : local.lastCompletedDate,
    isPremium: local.isPremium
  };
};

const getLocalDateKey = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const pushPendingTodayCompletion = async (
  local: LearningStateSnapshot,
  cloud: LearningStateSnapshot
) => {
  const today = getLocalDateKey();

  if (
    local.lastCompletedDate !== today ||
    cloud.lastCompletedDate === today ||
    local.currentExpressionId !== cloud.currentExpressionId ||
    !local.completedExpressionIds.includes(local.currentExpressionId)
  ) {
    return false;
  }

  const contentId = await requireContentDatabaseId(local.currentExpressionId);
  const { data, error } = await supabase.rpc('complete_current_content', {
    p_content_id: contentId
  });
  throwIfError(error);
  return data === true;
};

export const pushLibrarySnapshot = async (userId: string, snapshot: LearningStateSnapshot) => {
  const contentRows = await loadContentRows();
  const { databaseIdByExpressionId, expressionIdByDatabaseId } = buildContentMaps(contentRows);
  const categories = snapshot.savedCategories.some((category) => category.name === DEFAULT_CATEGORY_NAME)
    ? snapshot.savedCategories
    : [
        {
          id: DEFAULT_CATEGORY_ID,
          name: DEFAULT_CATEGORY_NAME,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        ...snapshot.savedCategories
      ];
  const uniqueCategories = Array.from(new Map(categories.map((category) => [category.name, category])).values());
  const { data: cloudCategories, error: categoryError } = await supabase
    .from('favorite_categories')
    .upsert(
      uniqueCategories.map((category, index) => ({
        user_id: userId,
        name: category.name,
        sort_order: category.name === DEFAULT_CATEGORY_NAME ? -100 : index
      })),
      { onConflict: 'user_id,name' }
    )
    .select('id, name');

  throwIfError(categoryError);

  const categoryDatabaseIdByLocalId = new Map<string, number>();
  const categoryDatabaseIdByName = new Map(
    (cloudCategories ?? []).map((category) => [category.name as string, category.id as number])
  );
  categories.forEach((category) => {
    const databaseId = categoryDatabaseIdByName.get(category.name);
    if (databaseId !== undefined) {
      categoryDatabaseIdByLocalId.set(category.id, databaseId);
    }
  });

  const desiredExpressionIds = uniqueNumbers([
    ...snapshot.favoriteExpressionIds,
    ...Object.keys(snapshot.savedExpressionCategoryIds).map(Number)
  ]).filter((expressionId) => databaseIdByExpressionId.has(expressionId));
  const favoriteRows = desiredExpressionIds.map((expressionId) => ({
    user_id: userId,
    content_id: databaseIdByExpressionId.get(expressionId) as number
  }));
  let cloudFavorites: FavoriteRow[] = [];

  if (favoriteRows.length > 0) {
    const { data, error } = await supabase
      .from('favorites')
      .upsert(favoriteRows, { onConflict: 'user_id,content_id' })
      .select('id, content_id');
    throwIfError(error);
    cloudFavorites = (data ?? []) as FavoriteRow[];
  }

  const favoriteDatabaseIdByExpressionId = new Map<number, number>();
  cloudFavorites.forEach((favorite) => {
    const expressionId = expressionIdByDatabaseId.get(favorite.content_id);
    if (expressionId !== undefined) {
      favoriteDatabaseIdByExpressionId.set(expressionId, favorite.id);
    }
  });

  const defaultCategoryDatabaseId = categoryDatabaseIdByName.get(DEFAULT_CATEGORY_NAME);
  const desiredItems: Array<{ favorite_id: number; category_id: number }> = [];
  desiredExpressionIds.forEach((expressionId) => {
    const favoriteId = favoriteDatabaseIdByExpressionId.get(expressionId);
    const localCategoryIds = snapshot.savedExpressionCategoryIds[String(expressionId)] ?? [DEFAULT_CATEGORY_ID];

    if (favoriteId === undefined) {
      return;
    }

    const categoryIds = localCategoryIds
      .map((categoryId) => categoryDatabaseIdByLocalId.get(categoryId))
      .filter((id): id is number => id !== undefined);

    if (categoryIds.length === 0 && defaultCategoryDatabaseId !== undefined) {
      categoryIds.push(defaultCategoryDatabaseId);
    }

    uniqueNumbers(categoryIds).forEach((categoryId) => {
      desiredItems.push({ favorite_id: favoriteId, category_id: categoryId });
    });
  });

  if (desiredItems.length > 0) {
    const { error } = await supabase
      .from('favorite_category_items')
      .upsert(desiredItems, {
        onConflict: 'favorite_id,category_id',
        ignoreDuplicates: true
      });
    throwIfError(error);
  }

  const [{ data: existingFavorites, error: existingFavoriteError }, { data: existingItems, error: existingItemError }] =
    await Promise.all([
      supabase.from('favorites').select('id, content_id').eq('user_id', userId),
      supabase.from('favorite_category_items').select('id, favorite_id, category_id')
    ]);
  throwIfError(existingFavoriteError);
  throwIfError(existingItemError);

  const desiredFavoriteIds = new Set(cloudFavorites.map((favorite) => favorite.id));
  const desiredItemKeys = new Set(desiredItems.map((item) => `${item.favorite_id}:${item.category_id}`));
  const extraItemIds = ((existingItems ?? []) as FavoriteItemRow[])
    .filter(
      (item) =>
        desiredFavoriteIds.has(item.favorite_id) &&
        !desiredItemKeys.has(`${item.favorite_id}:${item.category_id}`)
    )
    .map((item) => item.id);

  if (extraItemIds.length > 0) {
    const { error } = await supabase.from('favorite_category_items').delete().in('id', extraItemIds);
    throwIfError(error);
  }

  const extraFavoriteIds = ((existingFavorites ?? []) as FavoriteRow[])
    .filter((favorite) => !desiredFavoriteIds.has(favorite.id))
    .map((favorite) => favorite.id);

  if (extraFavoriteIds.length > 0) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .in('id', extraFavoriteIds);
    throwIfError(error);
  }
};

export const pushWrongNoteSnapshot = async (userId: string, expressionIds: number[]) => {
  const contentRows = await loadContentRows();
  const { databaseIdByExpressionId, expressionIdByDatabaseId } = buildContentMaps(contentRows);
  const { data, error } = await supabase
    .from('wrong_notes')
    .select('content_id')
    .eq('user_id', userId)
    .eq('status', 'active');
  throwIfError(error);

  const existingExpressionIds = new Set(
    (data ?? [])
      .map((note) => expressionIdByDatabaseId.get(note.content_id as number))
      .filter((id): id is number => id !== undefined)
  );
  const missingRows = uniqueNumbers(expressionIds)
    .filter((expressionId) => !existingExpressionIds.has(expressionId))
    .map((expressionId) => databaseIdByExpressionId.get(expressionId))
    .filter((contentId): contentId is number => contentId !== undefined)
    .map((contentId) => ({
      user_id: userId,
      content_id: contentId,
      selected_content_id: null,
      is_correct: false
    }));

  if (missingRows.length > 0) {
    const { error: insertError } = await supabase.from('review_attempts').insert(missingRows);
    throwIfError(insertError);
  }
};
