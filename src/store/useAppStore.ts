import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mockExpressions } from '@/data/mockExpressions';

export const DEFAULT_SAVED_CATEGORY_ID = 'default';

export type AdAgeTreatment = 'child' | 'teen' | 'adult';

export type SavedCategory = {
  id: string;
  name: string;
  createdAt: string;
};

export type AppState = {
  hasCompletedOnboarding: boolean;
  adAgeTreatment: AdAgeTreatment | null;
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
  setAdAgeTreatment: (value: AdAgeTreatment) => void;
  toggleFavorite: (id: number) => void;
  saveExpressionToCategory: (expressionId: number, categoryId: string) => void;
  removeExpressionFromCategory: (expressionId: number, categoryId: string) => void;
  createSavedCategory: (name: string) => string;
  recordReviewAnswer: (expressionId: number, isCorrect: boolean) => void;
  removeWrongAnswer: (expressionId: number) => void;
  clearWrongAnswers: () => void;
  completeToday: () => void;
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
  adAgeTreatment: null,
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

const normalizeExpressionId = (id: number) => {
  const total = mockExpressions.length;
  return ((id % total) + total) % total;
};

const getTodayExpressionId = () => {
  const today = new Date(`${getLocalDateKey()}T00:00:00`);
  const dayIndex = Math.floor(today.getTime() / 86_400_000);
  return normalizeExpressionId(dayIndex);
};

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
    (set) => ({
      ...initialState,
      hasHydrated: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true, currentExpressionId: getTodayExpressionId() }),
      setAdAgeTreatment: (value) => set({ adAgeTreatment: value }),
      toggleFavorite: (id) =>
        set((state) => {
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

          return {
            favoriteExpressionIds: syncFavoriteIdsFromSavedMap(savedExpressionCategoryIds),
            savedExpressionCategoryIds
          };
        }),
      saveExpressionToCategory: (expressionId, categoryId) =>
        set((state) => {
          const key = getExpressionKey(expressionId);
          const baseSavedMap = mergeLegacyFavoritesIntoMap(state);
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
        }),
      removeExpressionFromCategory: (expressionId, categoryId) =>
        set((state) => {
          const key = getExpressionKey(expressionId);
          const baseSavedMap = mergeLegacyFavoritesIntoMap(state);
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
        }),
      createSavedCategory: (name) => {
        const trimmedName = name.trim();
        const id = `category-${Date.now()}`;

        set((state) => ({
          savedCategories: [
            ...ensureDefaultCategory(state.savedCategories),
            {
              id,
              name: trimmedName.length > 0 ? trimmedName : `카테고리 ${state.savedCategories.length + 1}`,
              createdAt: new Date().toISOString()
            }
          ]
        }));

        return id;
      },
      recordReviewAnswer: (expressionId, isCorrect) =>
        set((state) => ({
          wrongAnswerExpressionIds: isCorrect
            ? state.wrongAnswerExpressionIds.filter((id) => id !== expressionId)
            : Array.from(new Set([...state.wrongAnswerExpressionIds, expressionId]))
        })),
      removeWrongAnswer: (expressionId) =>
        set((state) => ({
          wrongAnswerExpressionIds: state.wrongAnswerExpressionIds.filter((id) => id !== expressionId)
        })),
      clearWrongAnswers: () => set({ wrongAnswerExpressionIds: [] }),
      completeToday: () =>
        set((state) => {
          const today = getLocalDateKey();
          const todayExpressionId = getTodayExpressionId();
          const alreadyCompletedToday = state.lastCompletedDate === today;
          const completedExpressionIds = state.completedExpressionIds.includes(todayExpressionId)
            ? state.completedExpressionIds
            : [...state.completedExpressionIds, todayExpressionId];

          if (alreadyCompletedToday) {
            return {
              completedExpressionIds,
              currentExpressionId: todayExpressionId,
              lastCompletedDate: today
            };
          }

          const shouldContinueStreak =
            state.lastCompletedDate !== null && getDateDifference(state.lastCompletedDate, today) === 1;

          return {
            completedExpressionIds,
            currentExpressionId: todayExpressionId,
            streak: shouldContinueStreak ? state.streak + 1 : 1,
            lastCompletedDate: today
          };
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
            currentExpressionId: getTodayExpressionId(),
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
        adAgeTreatment: state.adAgeTreatment,
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

export const selectCurrentExpression = () => mockExpressions[getTodayExpressionId()];

export const selectExpressionForDaysAgo = (daysAgo: number) =>
  mockExpressions[normalizeExpressionId(getTodayExpressionId() - Math.max(0, Math.floor(daysAgo)))];

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

export const selectWrongAnswerExpressions = (state: AppStore) =>
  mockExpressions.filter((expression) => state.wrongAnswerExpressionIds.includes(expression.id));

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
