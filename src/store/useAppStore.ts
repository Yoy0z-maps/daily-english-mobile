import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LearningStateSnapshot } from '@/sync/learningSync';

export const DEFAULT_SAVED_CATEGORY_ID = 'default';

export type SavedCategory = {
  id: string;
  name: string;
  createdAt: string;
};

type AppState = LearningStateSnapshot & {
  hasCompletedOnboarding: boolean;
  isDarkMode: boolean;
  notificationsEnabled: boolean;
};

type AppActions = {
  completeOnboarding: () => void;
  applyCloudLearningState: (snapshot: LearningStateSnapshot) => void;
  clearUserSession: () => void;
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

const emptyLearningState: LearningStateSnapshot = {
  currentExpressionId: 0,
  completedExpressionIds: [],
  favoriteExpressionIds: [],
  savedCategories: [defaultSavedCategory],
  savedExpressionCategoryIds: {},
  wrongAnswerExpressionIds: [],
  streak: 0,
  longestStreak: 0,
  totalCompleted: 0,
  lastCompletedDate: null,
  isPremium: false
};

export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ensureDefaultCategory = (categories: SavedCategory[] = []) => {
  const withoutDuplicateDefault = categories.filter(
    (category) => category.id !== DEFAULT_SAVED_CATEGORY_ID
  );
  return [defaultSavedCategory, ...withoutDuplicateDefault];
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...emptyLearningState,
      hasCompletedOnboarding: false,
      isDarkMode: false,
      notificationsEnabled: true,
      hasHydrated: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      applyCloudLearningState: (snapshot) =>
        set({ ...snapshot, savedCategories: ensureDefaultCategory(snapshot.savedCategories) }),
      clearUserSession: () =>
        set({
          ...emptyLearningState,
          hasCompletedOnboarding: false
        }),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      markHydrated: () => set({ hasHydrated: true })
    }),
    {
      name: 'daily-english-device-settings-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        notificationsEnabled: state.notificationsEnabled
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState>;
        return {
          ...currentState,
          isDarkMode: persisted.isDarkMode ?? currentState.isDarkMode,
          notificationsEnabled:
            persisted.notificationsEnabled ?? currentState.notificationsEnabled
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);

export const selectSavedCategories = (state: AppStore) =>
  ensureDefaultCategory(state.savedCategories);

export const selectSavedCategoryIdsForExpression = (state: AppStore, id: number) =>
  state.savedExpressionCategoryIds[String(id)] ?? [];

export const selectIsExpressionSaved = (state: AppStore, id: number) =>
  selectSavedCategoryIdsForExpression(state, id).length > 0;

export const selectSavedExpressionIdsByCategory = (state: AppStore, categoryId: string) =>
  Object.entries(state.savedExpressionCategoryIds)
    .filter(([, categoryIds]) => categoryIds.includes(categoryId))
    .map(([id]) => Number(id))
    .filter(Number.isFinite);
