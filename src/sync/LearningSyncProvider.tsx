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
import { useAppStore } from '@/store/useAppStore';
import { loadCloudLearningState } from '@/sync/learningSync';

type LearningSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

type LearningSyncContextValue = {
  status: LearningSyncStatus;
  errorMessage: string | null;
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;
};

const LearningSyncContext = createContext<LearningSyncContextValue | null>(null);

export function LearningSyncProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const [status, setStatus] = useState<LearningSyncStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const activeSyncRef = useRef<Promise<void> | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    activeUserIdRef.current = userId;
    activeSyncRef.current = null;
    useAppStore.getState().clearUserSession();
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
    const syncTask = (async () => {
      setStatus('syncing');
      setErrorMessage(null);

      try {
        const cloudState = await loadCloudLearningState(syncingUserId);

        if (activeUserIdRef.current !== syncingUserId) {
          return;
        }

        useAppStore.getState().applyCloudLearningState(cloudState);
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
        activeSyncRef.current = null;
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

    return () => appStateSubscription?.remove();
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
