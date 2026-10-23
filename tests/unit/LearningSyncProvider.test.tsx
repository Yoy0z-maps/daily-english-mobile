import { beginLearningMutation } from '@/sync/pendingMutations';
import { useAppStore } from '@/store/useAppStore';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } })
}));

jest.mock('@/store/useAppStore', () => {
  const storeState = {
    hasHydrated: true,
    learningOwnerId: 'user-1' as string | null,
    applyCloudLearningState: jest.fn(),
    clearUserSession: jest.fn()
  };
  const useAppStore = Object.assign(
    jest.fn((selector: (state: typeof storeState) => unknown) => selector(storeState)),
    { getState: jest.fn(() => storeState) }
  );

  return { useAppStore };
});

jest.mock('@/sync/learningSync', () => ({
  importGuestLearningState: jest.fn().mockResolvedValue(undefined),
  loadCloudLearningState: jest.fn()
}));

jest.mock('@/learning/localLearning', () => ({
  buildGuestImportPayload: jest.fn(() => ({ completions: [], categories: [], saved: [], wrong_notes: [] })),
  hasLocalLearningData: jest.fn(() => true),
  normalizeLocalLearningState: jest.fn()
}));

import {
  LearningSyncProvider,
  useLearningSync
} from '@/sync/LearningSyncProvider';
import {
  importGuestLearningState,
  loadCloudLearningState,
  type LearningStateSnapshot
} from '@/sync/learningSync';

const mockLoadCloudLearningState = jest.mocked(loadCloudLearningState);

const snapshot: LearningStateSnapshot = {
  currentExpressionId: 1,
  completedExpressionIds: [],
  completedHistory: [],
  favoriteExpressionIds: [],
  savedCategories: [],
  savedExpressionCategoryIds: {},
  wrongAnswerExpressionIds: [],
  streak: 0,
  longestStreak: 0,
  totalCompleted: 0,
  lastCompletedDate: null,
  isPremium: false
};

const SyncProbe = () => {
  const { status, isInitialSyncing, syncNow } = useLearningSync();

  return (
    <View>
      <Text testID="status">{status}</Text>
      <Text testID="initial-syncing">{String(isInitialSyncing)}</Text>
      <Pressable testID="sync-now" onPress={() => void syncNow()}>
        <Text>동기화</Text>
      </Pressable>
    </View>
  );
};

describe('LearningSyncProvider', () => {
  it('최초 동기화만 초기 로딩으로 표시하고 이후 동기화는 백그라운드로 처리한다', async () => {
    // 다른 계정의 기록만 기기에 있으면 이 계정의 기록을 불러올 때까지 로딩을 보여준다.
    const state = useAppStore.getState() as unknown as { learningOwnerId: string | null };
    state.learningOwnerId = 'previous-user';
    let resolveInitialSync!: (value: LearningStateSnapshot) => void;
    mockLoadCloudLearningState.mockImplementationOnce(
      () =>
        new Promise<LearningStateSnapshot>((resolve) => {
          resolveInitialSync = resolve;
        })
    );

    const screen = render(
      <LearningSyncProvider>
        <SyncProbe />
      </LearningSyncProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('syncing');
      expect(screen.getByTestId('initial-syncing').props.children).toBe('true');
    });

    await act(async () => {
      resolveInitialSync(snapshot);
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('synced');
      expect(screen.getByTestId('initial-syncing').props.children).toBe('false');
    });

    let resolveBackgroundSync!: (value: LearningStateSnapshot) => void;
    mockLoadCloudLearningState.mockImplementationOnce(
      () =>
        new Promise<LearningStateSnapshot>((resolve) => {
          resolveBackgroundSync = resolve;
        })
    );

    fireEvent.press(screen.getByTestId('sync-now'));

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('syncing');
      expect(screen.getByTestId('initial-syncing').props.children).toBe('false');
    });

    await act(async () => {
      resolveBackgroundSync(snapshot);
    });
    state.learningOwnerId = 'user-1';
  });

  it('이 계정의 기록이 기기에 있으면 로딩 없이 보여주고 백그라운드에서 동기화한다', async () => {
    mockLoadCloudLearningState.mockResolvedValueOnce(snapshot);
    const screen = render(<LearningSyncProvider><SyncProbe /></LearningSyncProvider>);

    expect(screen.getByTestId('initial-syncing').props.children).toBe('false');
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('synced'));
  });
});


it('discards a stale sync response and refetches after an optimistic write settles', async () => {
  let resolveStale!: (value: LearningStateSnapshot) => void;
  mockLoadCloudLearningState.mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve; }));
  const updated = { ...snapshot, totalCompleted: 1 };
  mockLoadCloudLearningState.mockResolvedValueOnce(updated);
  render(<LearningSyncProvider><SyncProbe /></LearningSyncProvider>);
  await waitFor(() => expect(mockLoadCloudLearningState).toHaveBeenCalledTimes(1));
  const finish = beginLearningMutation();
  await act(async () => { resolveStale(snapshot); });
  expect(useAppStore.getState().applyCloudLearningState).not.toHaveBeenCalled();
  await act(async () => { finish(); });
  await waitFor(() => expect(useAppStore.getState().applyCloudLearningState).toHaveBeenCalledWith(updated, 'user-1'));
  expect(mockLoadCloudLearningState).toHaveBeenCalledTimes(2);
});

it('로그인 직후 기기에 저장된 게스트 기록을 계정으로 옮긴 뒤 불러온다', async () => {
  const state = useAppStore.getState() as unknown as { learningOwnerId: string | null };
  state.learningOwnerId = null;
  const order: string[] = [];
  jest.mocked(importGuestLearningState).mockImplementationOnce(async () => { order.push('import'); });
  mockLoadCloudLearningState.mockImplementationOnce(async () => { order.push('load'); return snapshot; });

  render(<LearningSyncProvider><SyncProbe /></LearningSyncProvider>);

  await waitFor(() => expect(useAppStore.getState().applyCloudLearningState).toHaveBeenCalledWith(snapshot, 'user-1'));
  expect(order).toEqual(['import', 'load']);
  expect(useAppStore.getState().clearUserSession).not.toHaveBeenCalled();
  state.learningOwnerId = 'user-1';
});
