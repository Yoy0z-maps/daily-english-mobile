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

// 앱을 켜거나 다시 열 때 토큰 갱신·네트워크가 잠깐 실패해도 다음 실행까지 기다리지 않도록 자동으로 다시 시도한다.
// Supabase auth는 토큰 갱신이 실패하면 60초 동안 같은 실패를 돌려주므로 마지막 재시도는 그 뒤로 잡는다.
export const SYNC_RETRY_DELAYS_MS = [3_000, 15_000, 75_000];

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
  const { session, isReady: isAuthReady } = useAuth();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const [status, setStatus] = useState<LearningSyncStatus>('idle');
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const activeSyncRef = useRef<Promise<void> | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  // 이번 실행에서 확인한 직전 로그인 사용자. 앱 시작 시의 "아직 세션 없음"과 실제 로그아웃을 구분한다.
  const confirmedUserIdRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const syncNowRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const userId = session?.user.id ?? null;
  // 기기 기록 복원과 세션 복원이 모두 끝나야 누구의 기록인지 판단할 수 있다.
  const isReady = hasHydrated && isAuthReady;

  const cancelRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      cancelRetry();
      // 화면 트리가 다시 만들어진 뒤(연결 확인 화면 등) 끝난 이전 동기화가 상태를 바꾸거나 재시도를 예약하지 않게 한다.
      activeUserIdRef.current = null;
    },
    [cancelRetry]
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const previousUserId = confirmedUserIdRef.current;
    confirmedUserIdRef.current = userId;
    activeUserIdRef.current = userId;
    activeSyncRef.current = null;
    cancelRetry();
    retryCountRef.current = 0;
    const { learningOwnerId, clearUserSession } = useAppStore.getState();

    // 게스트 기록(owner null)은 로그인 후 계정으로 옮기기 위해 남겨둔다.
    // 다른 계정으로 로그인했거나, 앱을 쓰는 중에 로그아웃된 경우에만 이전 계정 기록을 비운다.
    // 세션 복원 전이나 토큰 갱신 실패로 세션이 잠깐 비어 보이는 경우에는 기기 기록을 그대로 둬야
    // 오늘의 문장이 첫 문장으로 돌아가거나 위젯에 첫 문장이 저장되지 않는다.
    const isOtherAccount = userId !== null && learningOwnerId !== null && learningOwnerId !== userId;
    const didSignOut = userId === null && previousUserId !== null && learningOwnerId !== null;
    if (isOtherAccount || didSignOut) {
      clearUserSession();
    }

    setStatus(userId ? 'syncing' : 'idle');
    // 이 계정의 기록이 이미 기기에 있으면 그대로 보여주고 백그라운드에서 동기화한다.
    setIsInitialSyncing(Boolean(userId) && useAppStore.getState().learningOwnerId !== userId);
    setErrorMessage(null);
    setLastSyncedAt(null);
  }, [cancelRetry, isReady, userId]);

  const syncNow = useCallback(async () => {
    if (!isReady) {
      return;
    }

    // 날짜가 바뀌었으면 서버(complete_current_content·get_current_content_id)와 같은 규칙으로
    // 기기 기록을 먼저 오늘의 문장으로 넘겨 둔다. 서버 동기화가 실패해도 앱과 위젯이
    // 어제 문장에 머무르지 않게 하기 위함이며, 동기화가 성공하면 서버 값으로 덮어쓴다.
    normalizeLocalLearningState();

    if (!userId) {
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
        cancelRetry();
        retryCountRef.current = 0;
        setStatus('synced');
        setLastSyncedAt(new Date().toISOString());
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '학습 데이터를 동기화하지 못했습니다.';

        if (activeUserIdRef.current === syncingUserId) {
          console.warn('Supabase 학습 데이터 동기화에 실패했습니다.', error);
          setStatus('error');
          setErrorMessage(message);

          const retryDelay = SYNC_RETRY_DELAYS_MS[retryCountRef.current];
          if (retryDelay !== undefined && !retryTimerRef.current) {
            retryCountRef.current += 1;
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              void syncNowRef.current();
            }, retryDelay);
          }
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
  }, [cancelRetry, isReady, userId]);

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  useEffect(() => {
    if (!isReady) {
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
  }, [isReady, syncNow]);

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
