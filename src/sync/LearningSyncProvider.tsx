import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import {
  flushPendingLearningOperations,
  loadCloudLearningState,
  mergeLearningStates,
  pushLibrarySnapshot,
  pushPendingTodayCompletion,
  pushWrongNoteSnapshot,
  type LearningStateSnapshot
} from '@/sync/learningSync';

type LearningSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

type LearningSyncContextValue = {
  status: LearningSyncStatus;
  errorMessage: string | null;
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;
};

const LearningSyncContext = createContext<LearningSyncContextValue | null>(null);

const getLocalSnapshot = (): LearningStateSnapshot => {
  const state = useAppStore.getState();

  return {
    currentExpressionId: state.currentExpressionId,
    completedExpressionIds: state.completedExpressionIds,
    favoriteExpressionIds: state.favoriteExpressionIds,
    savedCategories: state.savedCategories,
    savedExpressionCategoryIds: state.savedExpressionCategoryIds,
    wrongAnswerExpressionIds: state.wrongAnswerExpressionIds,
    streak: state.streak,
    lastCompletedDate: state.lastCompletedDate,
    isPremium: state.isPremium
  };
};

export function LearningSyncProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const [status, setStatus] = useState<LearningSyncStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const activeSyncRef = useRef<Promise<void> | null>(null);
  const syncSequenceRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    activeUserIdRef.current = userId;
    activeSyncRef.current = null;
    syncSequenceRef.current += 1;
    setStatus(userId ? 'syncing' : 'idle');
    setErrorMessage(null);
    setLastSyncedAt(null);
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!userId || !hasHydrated) {
      setStatus('idle');
      return;
    }

    if (activeSyncRef.current) {
      return activeSyncRef.current;
    }

    const syncingUserId = userId;
    const syncSequence = ++syncSequenceRef.current;
    const syncTask = (async () => {
      setStatus('syncing');
      setErrorMessage(null);

      try {
        await flushPendingLearningOperations(syncingUserId);

        const localState = getLocalSnapshot();
        let cloudState = await loadCloudLearningState(syncingUserId);
        const pushedTodayCompletion = await pushPendingTodayCompletion(localState, cloudState);

        if (pushedTodayCompletion) {
          cloudState = await loadCloudLearningState(syncingUserId);
        }

        const mergedState = mergeLearningStates(localState, cloudState);

        if (activeUserIdRef.current !== syncingUserId) {
          return;
        }

        useAppStore.getState().applyCloudLearningState(mergedState);
        await Promise.all([
          pushLibrarySnapshot(syncingUserId, mergedState),
          pushWrongNoteSnapshot(syncingUserId, mergedState.wrongAnswerExpressionIds)
        ]);

        if (activeUserIdRef.current === syncingUserId) {
          setStatus('synced');
          setLastSyncedAt(new Date().toISOString());
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '학습 데이터를 동기화하지 못했습니다.';

        if (activeUserIdRef.current === syncingUserId) {
          console.warn('Supabase 학습 데이터 동기화에 실패했습니다.', error);
          setStatus('error');
          setErrorMessage(message);
        }
      } finally {
        if (syncSequenceRef.current === syncSequence) {
          activeSyncRef.current = null;
        }
      }
    })();

    activeSyncRef.current = syncTask;
    return syncTask;
  }, [hasHydrated, userId]);

  useEffect(() => {
    if (!userId || !hasHydrated) {
      return;
    }

    void syncNow();

    const appStateSubscription =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
              void syncNow();
            }
          });

    return () => {
      appStateSubscription?.remove();
    };
  }, [hasHydrated, syncNow, userId]);

  const value = useMemo<LearningSyncContextValue>(
    () => ({ status, errorMessage, lastSyncedAt, syncNow }),
    [errorMessage, lastSyncedAt, status, syncNow]
  );

  return <LearningSyncContext.Provider value={value}>{children}</LearningSyncContext.Provider>;
}

export function useLearningSync() {
  const context = useContext(LearningSyncContext);

  if (!context) {
    throw new Error('useLearningSync는 LearningSyncProvider 안에서 사용해야 합니다.');
  }

  return context;
}
