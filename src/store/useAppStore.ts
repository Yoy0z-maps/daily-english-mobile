import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LearningStateSnapshot } from '@/sync/learningSync';

type CompletionSnapshot = Pick<
  LearningStateSnapshot,
  'completedExpressionIds' | 'completedHistory' | 'lastCompletedDate' | 'streak' | 'longestStreak' | 'totalCompleted'
>;

type SavedMembershipSnapshot = Pick<
  LearningStateSnapshot,
  'favoriteExpressionIds' | 'savedExpressionCategoryIds'
>;

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
  isAdminMode: boolean;
};

type AppActions = {
  completeOnboarding: () => void;
  applyCloudLearningState: (snapshot: LearningStateSnapshot) => void;
  clearUserSession: () => void;
  toggleDarkMode: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  markHydrated: () => void;
  enterAdminMode: () => void;
  applyOptimisticCompletion: (expressionId: number) => CompletionSnapshot;
  revertOptimisticCompletion: (snapshot: CompletionSnapshot) => void;
  applyOptimisticCategoryToggle: (
    expressionId: number,
    categoryId: string
  ) => SavedMembershipSnapshot;
  revertOptimisticCategoryToggle: (snapshot: SavedMembershipSnapshot) => void;
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
  completedHistory: [],
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
    (set, get) => ({
      ...emptyLearningState,
      hasCompletedOnboarding: false,
      isDarkMode: false,
      notificationsEnabled: true,
      isAdminMode: false,
      hasHydrated: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      applyCloudLearningState: (snapshot) =>
        set({ ...snapshot, savedCategories: ensureDefaultCategory(snapshot.savedCategories) }),
      clearUserSession: () =>
        set({
          ...emptyLearningState,
          hasCompletedOnboarding: false,
          isAdminMode: false
        }),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      markHydrated: () => set({ hasHydrated: true }),
      // 심사용 데모 계정 진입 — 실제 백엔드 세션 없이 로컬 상태만으로 홈 화면 접근을 허용한다.
      enterAdminMode: () => set({ isAdminMode: true, hasCompletedOnboarding: true }),
      // 낙관적 업데이트: 서버 응답을 기다리지 않고 먼저 화면을 갱신하고, 실패하면 이 스냅샷으로 되돌린다.
      applyOptimisticCompletion: (expressionId) => {
        const state = get();
        const snapshot: CompletionSnapshot = {
          completedExpressionIds: state.completedExpressionIds,
          completedHistory: state.completedHistory,
          lastCompletedDate: state.lastCompletedDate,
          streak: state.streak,
          longestStreak: state.longestStreak,
          totalCompleted: state.totalCompleted
        };

        const todayKey = getLocalDateKey();
        const yesterdayKey = getLocalDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
        const nextStreak =
          state.lastCompletedDate === todayKey
            ? state.streak
            : state.lastCompletedDate === yesterdayKey
              ? state.streak + 1
              : 1;

        set({
          completedExpressionIds: state.completedExpressionIds.includes(expressionId)
            ? state.completedExpressionIds
            : [...state.completedExpressionIds, expressionId],
          completedHistory: state.completedHistory.some(
            (entry) => entry.expressionId === expressionId
          )
            ? state.completedHistory
            : [{ expressionId, completedDate: todayKey }, ...state.completedHistory],
          lastCompletedDate: todayKey,
          streak: nextStreak,
          longestStreak: Math.max(state.longestStreak, nextStreak),
          totalCompleted: state.totalCompleted + 1
        });

        return snapshot;
      },
      revertOptimisticCompletion: (snapshot) => set(snapshot),
      applyOptimisticCategoryToggle: (expressionId, categoryId) => {
        const state = get();
        const snapshot: SavedMembershipSnapshot = {
          favoriteExpressionIds: state.favoriteExpressionIds,
          savedExpressionCategoryIds: state.savedExpressionCategoryIds
        };

        const key = String(expressionId);
        const currentCategoryIds = state.savedExpressionCategoryIds[key] ?? [];
        const isCurrentlySaved = currentCategoryIds.includes(categoryId);
        const nextCategoryIds = isCurrentlySaved
          ? currentCategoryIds.filter((id) => id !== categoryId)
          : [...currentCategoryIds, categoryId];
        const nextSavedExpressionCategoryIds = { ...state.savedExpressionCategoryIds };

        if (nextCategoryIds.length > 0) {
          nextSavedExpressionCategoryIds[key] = nextCategoryIds;
        } else {
          delete nextSavedExpressionCategoryIds[key];
        }

        set({
          savedExpressionCategoryIds: nextSavedExpressionCategoryIds,
          favoriteExpressionIds: Object.keys(nextSavedExpressionCategoryIds).map(Number)
        });

        return snapshot;
      },
      revertOptimisticCategoryToggle: (snapshot) => set(snapshot)
    }),
    {
      name: 'daily-english-device-settings-v1',
      version: 1,
      // Preserve an explicit opt-out; new installations default to enabled.
      migrate: (persisted) => ({
        ...(persisted as Partial<AppState>),
        notificationsEnabled: (persisted as Partial<AppState>)?.notificationsEnabled ?? true
      }),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        notificationsEnabled: state.notificationsEnabled
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState && typeof persistedState === 'object'
          ? persistedState as Partial<AppState>
          : {};
        return {
          ...currentState,
          isDarkMode: persisted.isDarkMode ?? currentState.isDarkMode,
          notificationsEnabled:
            persisted.notificationsEnabled ?? currentState.notificationsEnabled
        };
      },
      onRehydrateStorage: (initialState) => (state, error) => {
        if (error) {
          console.warn('기기 설정을 복원하지 못해 기본 설정으로 시작합니다.', error);
        }
        // Zustand passes no state when hydration fails. Startup must still
        // finish so device-preference errors cannot block login or learning.
        (state ?? initialState).markHydrated();
      }
    }
  )
);

export const selectEffectiveIsPremium = (state: AppStore) => state.isPremium || state.isAdminMode;

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
