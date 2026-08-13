import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  enqueueLearningOperation,
  type LearningStateSnapshot
} from '@/sync/learningSync';

export const DEFAULT_SAVED_CATEGORY_ID = 'default';

export type SavedCategory = {
  id: string;
  name: string;
  createdAt: string;
};

export type AppState = {
  hasCompletedOnboarding: boolean;
  isPremium: boolean;
  currentExpressionId: number;
  completedExpressionIds: number[];
  favoriteExpressionIds: number[];
  savedCategories: SavedCategory[];
  savedExpressionCategoryIds: Record<string, string[]>;
  wrongAnswerExpressionIds: number[];
  streak: number;
  lastCompletedDate: string | null;
  isDarkMode: boolean;
  notificationsEnabled: boolean;
};

type AppActions = {
  completeOnboarding: () => void;
  toggleFavorite: (id: number) => void;
  saveExpressionToCategory: (expressionId: number, categoryId: string) => void;
  removeExpressionFromCategory: (expressionId: number, categoryId: string) => void;
  createSavedCategory: (name: string) => string;
  recordReviewAnswer: (
    expressionId: number,
    isCorrect: boolean,
    selectedExpressionId?: number | null
  ) => void;
  removeWrongAnswer: (expressionId: number) => void;
  clearWrongAnswers: () => void;
  clearUserSession: () => void;
  completeToday: () => void;
  applyCloudLearningState: (snapshot: LearningStateSnapshot) => void;
  setPremium: (value: boolean) => void;
  toggleDarkMode: () => void;
  toggleNotifications: () => void;
  markHydrated: () => void;
};

type InternalState = {
  hasHydrated: boolean;
};

export type AppStore = AppState & AppActions & InternalState;

export const defaultSavedCategory: SavedCategory = {
  id: DEFAULT_SAVED_CATEGORY_ID,
  name: '기본',
  createdAt: '2026-01-01T00:00:00.000Z'
};

const initialState: AppState = {
  hasCompletedOnboarding: false,
  isPremium: false,
  currentExpressionId: 0,
  completedExpressionIds: [],
  favoriteExpressionIds: [],
  savedCategories: [defaultSavedCategory],
  savedExpressionCategoryIds: {},
  wrongAnswerExpressionIds: [],
  streak: 0,
  lastCompletedDate: null,
  isDarkMode: false,
  notificationsEnabled: true
};

export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateDifference = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
};

const normalizeExpressionId = (id: number) =>
  Number.isFinite(id) ? Math.max(0, Math.floor(id)) : 0;

const uniqueExpressionIds = (ids: number[]) =>
  Array.from(new Set(ids.filter(Number.isFinite).map(normalizeExpressionId)));

const getExpressionKey = (id: number) => String(id);

const ensureDefaultCategory = (categories: SavedCategory[] = []) => {
  const withoutDuplicateDefault = categories.filter((category) => category.id !== DEFAULT_SAVED_CATEGORY_ID);
  return [defaultSavedCategory, ...withoutDuplicateDefault];
};

const getSavedCategoryIds = (state: Pick<AppState, 'favoriteExpressionIds' | 'savedExpressionCategoryIds'>, id: number) => {
  const directCategoryIds = state.savedExpressionCategoryIds[getExpressionKey(id)] ?? [];

  if (directCategoryIds.length > 0) {
    return directCategoryIds;
  }

  return state.favoriteExpressionIds.includes(id) ? [DEFAULT_SAVED_CATEGORY_ID] : [];
};

const syncFavoriteIdsFromSavedMap = (savedExpressionCategoryIds: Record<string, string[]>) =>
  Object.entries(savedExpressionCategoryIds)
    .filter(([, categoryIds]) => categoryIds.length > 0)
    .map(([id]) => Number(id))
    .filter((id) => Number.isFinite(id));

const mergeLegacyFavoritesIntoMap = (
  state: Pick<AppState, 'favoriteExpressionIds' | 'savedExpressionCategoryIds'>
) => {
  const nextMap = { ...state.savedExpressionCategoryIds };

  state.favoriteExpressionIds.forEach((id) => {
    const key = getExpressionKey(id);
    if (!nextMap[key] || nextMap[key].length === 0) {
      nextMap[key] = [DEFAULT_SAVED_CATEGORY_ID];
    }
  });

  return nextMap;
};

const removeCategoryFromMap = (
  savedExpressionCategoryIds: Record<string, string[]>,
  expressionId: number,
  categoryId: string
) => {
  const key = getExpressionKey(expressionId);
  const currentCategoryIds = savedExpressionCategoryIds[key] ?? [];
  const nextCategoryIds = currentCategoryIds.filter((savedCategoryId) => savedCategoryId !== categoryId);
  const nextMap = { ...savedExpressionCategoryIds };

  if (nextCategoryIds.length === 0) {
    delete nextMap[key];
  } else {
    nextMap[key] = nextCategoryIds;
  }

  return nextMap;
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      hasHydrated: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      toggleFavorite: (id) => {
        const state = get();
        const baseSavedMap = mergeLegacyFavoritesIntoMap(state);
        const currentCategoryIds = baseSavedMap[getExpressionKey(id)] ?? [];
        const key = getExpressionKey(id);
        let savedExpressionCategoryIds: Record<string, string[]>;

        if (currentCategoryIds.length > 0) {
          savedExpressionCategoryIds = { ...baseSavedMap };
          delete savedExpressionCategoryIds[key];
        } else {
          savedExpressionCategoryIds = {
            ...state.savedExpressionCategoryIds,
            [key]: [DEFAULT_SAVED_CATEGORY_ID]
          };
        }

        set({
          favoriteExpressionIds: syncFavoriteIdsFromSavedMap(savedExpressionCategoryIds),
          savedExpressionCategoryIds
        });
        void enqueueLearningOperation({
          type: currentCategoryIds.length > 0 ? 'remove_from_category' : 'save_to_category',
          expressionId: id,
          categoryName: defaultSavedCategory.name
        });
      },
      saveExpressionToCategory: (expressionId, categoryId) => {
        const state = get();
        const categoryName =
          state.savedCategories.find((category) => category.id === categoryId)?.name ??
          defaultSavedCategory.name;

        set((currentState) => {
          const key = getExpressionKey(expressionId);
          const baseSavedMap = mergeLegacyFavoritesIntoMap(currentState);
          const currentCategoryIds = baseSavedMap[key] ?? [];
          const nextCategoryIds = Array.from(new Set([...currentCategoryIds, categoryId]));
          const savedExpressionCategoryIds = {
            ...baseSavedMap,
            [key]: nextCategoryIds
          };

          return {
            favoriteExpressionIds: syncFavoriteIdsFromSavedMap(savedExpressionCategoryIds),
            savedExpressionCategoryIds
          };
        });
        void enqueueLearningOperation({
          type: 'save_to_category',
          expressionId,
          categoryName
        });
      },
      removeExpressionFromCategory: (expressionId, categoryId) => {
        const state = get();
        const categoryName =
          state.savedCategories.find((category) => category.id === categoryId)?.name ??
          defaultSavedCategory.name;

        set((currentState) => {
          const key = getExpressionKey(expressionId);
          const baseSavedMap = mergeLegacyFavoritesIntoMap(currentState);
          const currentCategoryIds = baseSavedMap[key] ?? [];
          const savedExpressionCategoryIds = removeCategoryFromMap(
            {
              ...baseSavedMap,
              [key]: currentCategoryIds
            },
            expressionId,
            categoryId
          );

          return {
            favoriteExpressionIds: syncFavoriteIdsFromSavedMap(savedExpressionCategoryIds),
            savedExpressionCategoryIds
          };
        });
        void enqueueLearningOperation({
          type: 'remove_from_category',
          expressionId,
          categoryName
        });
      },
      createSavedCategory: (name) => {
        const trimmedName = name.trim();
        const id = `category-${Date.now()}`;
        const categoryName =
          trimmedName.length > 0 ? trimmedName : `카테고리 ${get().savedCategories.length + 1}`;

        set((state) => ({
          savedCategories: [
            ...ensureDefaultCategory(state.savedCategories),
            {
              id,
              name: categoryName,
              createdAt: new Date().toISOString()
            }
          ]
        }));

        void enqueueLearningOperation({ type: 'create_category', categoryName });

        return id;
      },
      recordReviewAnswer: (expressionId, isCorrect, selectedExpressionId = null) => {
        set((state) => ({
          wrongAnswerExpressionIds: isCorrect
            ? state.wrongAnswerExpressionIds.filter((id) => id !== expressionId)
            : Array.from(new Set([...state.wrongAnswerExpressionIds, expressionId]))
        }));
        void enqueueLearningOperation({
          type: 'record_review',
          expressionId,
          selectedExpressionId,
          isCorrect
        });
      },
      removeWrongAnswer: (expressionId) => {
        set((state) => ({
          wrongAnswerExpressionIds: state.wrongAnswerExpressionIds.filter((id) => id !== expressionId)
        }));
        void enqueueLearningOperation({ type: 'remove_wrong_note', expressionId });
      },
      clearWrongAnswers: () => {
        set({ wrongAnswerExpressionIds: [] });
        void enqueueLearningOperation({ type: 'clear_wrong_notes' });
      },
      clearUserSession: () =>
        set({
          hasCompletedOnboarding: false,
          isPremium: false,
          currentExpressionId: 0,
          completedExpressionIds: [],
          favoriteExpressionIds: [],
          savedCategories: [defaultSavedCategory],
          savedExpressionCategoryIds: {},
          wrongAnswerExpressionIds: [],
          streak: 0,
          lastCompletedDate: null
        }),
      completeToday: () => {
        const expressionId = get().currentExpressionId;

        set((state) => {
          const today = getLocalDateKey();
          const alreadyCompletedToday = state.lastCompletedDate === today;
          const completedExpressionIds = state.completedExpressionIds.includes(expressionId)
            ? state.completedExpressionIds
            : [...state.completedExpressionIds, expressionId];

          if (alreadyCompletedToday) {
            return {
              completedExpressionIds,
              currentExpressionId: expressionId,
              lastCompletedDate: today
            };
          }

          const shouldContinueStreak =
            state.lastCompletedDate !== null && getDateDifference(state.lastCompletedDate, today) === 1;

          return {
            completedExpressionIds,
            currentExpressionId: expressionId,
            streak: shouldContinueStreak ? state.streak + 1 : 1,
            lastCompletedDate: today
          };
        });

        void enqueueLearningOperation({ type: 'complete_content', expressionId });
      },
      applyCloudLearningState: (snapshot) =>
        set({
          currentExpressionId: normalizeExpressionId(snapshot.currentExpressionId),
          completedExpressionIds: uniqueExpressionIds(snapshot.completedExpressionIds),
          favoriteExpressionIds: uniqueExpressionIds(snapshot.favoriteExpressionIds),
          savedCategories: ensureDefaultCategory(snapshot.savedCategories),
          savedExpressionCategoryIds: snapshot.savedExpressionCategoryIds,
          wrongAnswerExpressionIds: uniqueExpressionIds(snapshot.wrongAnswerExpressionIds),
          streak: snapshot.streak,
          lastCompletedDate: snapshot.lastCompletedDate,
          isPremium: snapshot.isPremium
        }),
      setPremium: (value) => set({ isPremium: value }),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      toggleNotifications: () =>
        set((state) => ({
          notificationsEnabled: !state.notificationsEnabled
        })),
      markHydrated: () =>
        set((state) => {
          const savedExpressionCategoryIds = mergeLegacyFavoritesIntoMap(state);

          return {
            favoriteExpressionIds: syncFavoriteIdsFromSavedMap(savedExpressionCategoryIds),
            hasHydrated: true,
            currentExpressionId: normalizeExpressionId(state.currentExpressionId),
            savedCategories: ensureDefaultCategory(state.savedCategories),
            savedExpressionCategoryIds
          };
        })
    }),
    {
      name: 'daily-english-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        isPremium: state.isPremium,
        currentExpressionId: state.currentExpressionId,
        completedExpressionIds: state.completedExpressionIds,
        favoriteExpressionIds: state.favoriteExpressionIds,
        savedCategories: state.savedCategories,
        savedExpressionCategoryIds: state.savedExpressionCategoryIds,
        wrongAnswerExpressionIds: state.wrongAnswerExpressionIds,
        streak: state.streak,
        lastCompletedDate: state.lastCompletedDate,
        isDarkMode: state.isDarkMode,
        notificationsEnabled: state.notificationsEnabled
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);

export const selectSavedCategories = (state: AppStore) => ensureDefaultCategory(state.savedCategories);

export const selectSavedCategoryIdsForExpression = (state: AppStore, id: number) => getSavedCategoryIds(state, id);

export const selectIsExpressionSaved = (state: AppStore, id: number) =>
  selectSavedCategoryIdsForExpression(state, id).length > 0;

export const selectAllSavedExpressionIds = (state: AppStore) => {
  const ids = new Set<number>(state.favoriteExpressionIds);

  Object.entries(state.savedExpressionCategoryIds).forEach(([id, categoryIds]) => {
    if (categoryIds.length > 0) {
      ids.add(Number(id));
    }
  });

  return Array.from(ids).filter((id) => Number.isFinite(id));
};

export const selectSavedExpressionIdsByCategory = (state: AppStore, categoryId: string) => {
  const ids = new Set<number>();

  Object.entries(state.savedExpressionCategoryIds).forEach(([id, categoryIds]) => {
    if (categoryIds.includes(categoryId)) {
      ids.add(Number(id));
    }
  });

  if (categoryId === DEFAULT_SAVED_CATEGORY_ID) {
    state.favoriteExpressionIds.forEach((id) => ids.add(id));
  }

  return Array.from(ids).filter((id) => Number.isFinite(id));
};
