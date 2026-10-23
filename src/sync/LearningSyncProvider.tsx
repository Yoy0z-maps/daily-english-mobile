import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import {
  buildGuestImportPayload,
  hasLocalLearningData,
  normalizeLocalLearningState
} from '@/learning/localLearning';
import { useAppStore } from '@/store/useAppStore';
import { importGuestLearningState, loadCloudLearningState } from '@/sync/learningSync';

import { mutationRevision, waitForLearningMutations } from '@/sync/pendingMutations';

type LearningSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

type LearningSyncContextValue = {
  // 로그인 없이 기기에만 학습 기록을 저장하는 상태
  isGuest: boolean;
  status: LearningSyncStatus;
  isInitialSyncing: boolean;
  errorMessage: string | null;
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;
};

const LearningSyncContext = createContext<LearningSyncContextValue | null>(null);

export function LearningSyncProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const [status, setStatus] = useState<LearningSyncStatus>('idle');
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const activeSyncRef = useRef<Promise<void> | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    activeUserIdRef.current = userId;
    activeSyncRef.current = null;
    const { learningOwnerId, clearUserSession } = useAppStore.getState();

    // 게스트 기록(owner null)은 로그인 후 계정으로 옮기기 위해 남겨두고,
    // 다른 계정의 기록만 비운다.
    if (learningOwnerId !== null && learningOwnerId !== userId) {
      clearUserSession();
    }

    setStatus(userId ? 'syncing' : 'idle');
    // 이 계정의 기록이 이미 기기에 있으면 그대로 보여주고 백그라운드에서 동기화한다.
    setIsInitialSyncing(Boolean(userId) && useAppStore.getState().learningOwnerId !== userId);
    setErrorMessage(null);
    setLastSyncedAt(null);
  }, [hasHydrated, userId]);

  const syncNow = useCallback(async () => {
    if (!hasHydrated) {
      return;
    }

    if (!userId) {
      normalizeLocalLearningState();
      setStatus('idle');
      return;
    }

    if (activeSyncRef.current) {
      return activeSyncRef.current;
    }

    const syncingUserId = userId;
    const syncTask = (async () => {
      setStatus('syncing');
      setErrorMessage(null);

      try {
        await waitForLearningMutations();
        if (activeUserIdRef.current !== syncingUserId) return;

        const localState = useAppStore.getState();
        if (localState.learningOwnerId === null && hasLocalLearningData(localState)) {
          await importGuestLearningState(buildGuestImportPayload(localState));
          if (activeUserIdRef.current !== syncingUserId) return;
        }

        let revision = mutationRevision();
        let cloudState = await loadCloudLearningState(syncingUserId);
        while (revision !== mutationRevision()) {
          await waitForLearningMutations();
          if (activeUserIdRef.current !== syncingUserId) return;
          revision = mutationRevision();
          cloudState = await loadCloudLearningState(syncingUserId);
        }

        if (activeUserIdRef.current !== syncingUserId) {
          return;
        }

        useAppStore.getState().applyCloudLearningState(cloudState, syncingUserId);
        setStatus('synced');
        setLastSyncedAt(new Date().toISOString());
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '학습 데이터를 동기화하지 못했습니다.';

        if (activeUserIdRef.current === syncingUserId) {
          console.warn('Supabase 학습 데이터 동기화에 실패했습니다.', error);
          setStatus('error');
          setErrorMessage(message);
        }
      } finally {
        if (activeUserIdRef.current === syncingUserId) {
          setIsInitialSyncing(false);
        }
        if (activeUserIdRef.current === syncingUserId) activeSyncRef.current = null;
      }
    })();

    activeSyncRef.current = syncTask;
    return syncTask;
  }, [hasHydrated, userId]);

  useEffect(() => {
    if (!hasHydrated) {
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

    return () => appStateSubscription?.remove();
  }, [hasHydrated, syncNow]);

  const value = useMemo<LearningSyncContextValue>(
    () => ({ isGuest: !userId, status, isInitialSyncing, errorMessage, lastSyncedAt, syncNow }),
    [errorMessage, isInitialSyncing, lastSyncedAt, status, syncNow, userId]
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
