import type { Session } from '@supabase/supabase-js';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { getLocalDateKey, useAppStore } from '@/store/useAppStore';
import type { LearningStateSnapshot } from '@/sync/learningSync';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined)
}));

// 앱 시작 직후처럼 세션 복원이 끝나지 않은 상태를 재현하기 위해 테스트마다 인증 상태를 바꾼다.
let mockAuth: { isReady: boolean; session: Session | null } = { isReady: false, session: null };
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => mockAuth
}));

jest.mock('@/sync/learningSync', () => ({
  importGuestLearningState: jest.fn().mockResolvedValue(undefined),
  loadCloudLearningState: jest.fn()
}));

import { LearningSyncProvider, useLearningSync } from '@/sync/LearningSyncProvider';
import { loadCloudLearningState } from '@/sync/learningSync';

const mockLoadCloudLearningState = jest.mocked(loadCloudLearningState);
const sessionFor = (id: string) => ({ user: { id }, access_token: `token-${id}` }) as unknown as Session;
const DAY_MS = 24 * 60 * 60 * 1000;
const todayKey = () => getLocalDateKey();
const yesterdayKey = () => getLocalDateKey(new Date(Date.now() - DAY_MS));

const cloudSnapshot = (overrides: Partial<LearningStateSnapshot> = {}): LearningStateSnapshot => ({
  currentExpressionId: 42,
  completedExpressionIds: [40, 41],
  completedHistory: [
    { expressionId: 41, completedDate: yesterdayKey() },
    { expressionId: 40, completedDate: getLocalDateKey(new Date(Date.now() - 2 * DAY_MS)) }
  ],
  favoriteExpressionIds: [],
  savedCategories: [],
  savedExpressionCategoryIds: {},
  wrongAnswerExpressionIds: [],
  streak: 2,
  longestStreak: 2,
  totalCompleted: 2,
  lastCompletedDate: yesterdayKey(),
  isPremium: false,
  ...overrides
});

// 어제 41번까지 완료하고 마지막으로 동기화한 계정 기록이 기기에 저장돼 있는 상태.
const seedSyncedDevice = () => {
  useAppStore.setState({
    hasHydrated: true,
    learningOwnerId: 'user-1',
    currentExpressionId: 41,
    completedExpressionIds: [40, 41],
    completedHistory: cloudSnapshot().completedHistory,
    lastCompletedDate: yesterdayKey(),
    streak: 2,
    longestStreak: 2,
    totalCompleted: 2
  });
};

const Probe = () => {
  const { status, isInitialSyncing } = useLearningSync();
  return (
    <View>
      <Text testID="status">{status}</Text>
      <Text testID="initial-syncing">{String(isInitialSyncing)}</Text>
    </View>
  );
};

const renderProvider = () => render(<LearningSyncProvider><Probe /></LearningSyncProvider>);

beforeEach(() => {
  jest.useRealTimers();
  mockAuth = { isReady: false, session: null };
  mockLoadCloudLearningState.mockReset();
  useAppStore.getState().clearUserSession();
});

it('세션 복원이 끝나기 전에는 기기에 저장된 계정 학습 기록을 지우지 않는다', async () => {
  seedSyncedDevice();
  mockLoadCloudLearningState.mockResolvedValue(cloudSnapshot());

  const screen = renderProvider();
  await act(async () => {});

  expect(useAppStore.getState()).toMatchObject({ learningOwnerId: 'user-1', currentExpressionId: 41 });
  expect(mockLoadCloudLearningState).not.toHaveBeenCalled();

  mockAuth = { isReady: true, session: sessionFor('user-1') };
  screen.rerender(<LearningSyncProvider><Probe /></LearningSyncProvider>);

  // 이 계정의 기록이 있으므로 로딩 없이 보여주고 백그라운드에서 동기화한다.
  expect(screen.getByTestId('initial-syncing').props.children).toBe('false');
  await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('synced'));
  expect(useAppStore.getState().currentExpressionId).toBe(42);
});

it('동기화가 실패해도 첫 문장으로 돌아가지 않고 오늘의 문장을 유지한다', async () => {
  seedSyncedDevice();
  mockLoadCloudLearningState.mockRejectedValue(new Error('Authentication is required'));

  const screen = renderProvider();
  await act(async () => {});
  mockAuth = { isReady: true, session: sessionFor('user-1') };
  screen.rerender(<LearningSyncProvider><Probe /></LearningSyncProvider>);

  await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('error'));
  // 어제 41번을 완료했으므로 서버 규칙과 같이 오늘은 42번 이후 문장이 오늘의 문장이다.
  expect(useAppStore.getState()).toMatchObject({
    learningOwnerId: 'user-1',
    currentExpressionId: 42,
    completedExpressionIds: [40, 41]
  });
  screen.unmount();
});

it('세션을 복원하지 못해 비로그인으로 시작해도 계정 기록을 지우지 않는다', async () => {
  seedSyncedDevice();
  mockAuth = { isReady: true, session: null };

  renderProvider();
  await act(async () => {});

  expect(useAppStore.getState()).toMatchObject({ learningOwnerId: 'user-1', completedExpressionIds: [40, 41] });
});

it('앱을 쓰는 중에 로그아웃되면 이전 계정 기록을 비운다', async () => {
  seedSyncedDevice();
  mockAuth = { isReady: true, session: sessionFor('user-1') };
  mockLoadCloudLearningState.mockResolvedValue(cloudSnapshot());

  const screen = renderProvider();
  await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('synced'));

  mockAuth = { isReady: true, session: null };
  screen.rerender(<LearningSyncProvider><Probe /></LearningSyncProvider>);
  await act(async () => {});

  expect(useAppStore.getState()).toMatchObject({
    learningOwnerId: null,
    currentExpressionId: 0,
    completedExpressionIds: []
  });
});

it('다른 계정으로 로그인하면 이전 계정 기록을 비우고 새 계정 기록을 불러올 때까지 로딩을 보여준다', async () => {
  seedSyncedDevice();
  mockAuth = { isReady: true, session: sessionFor('user-2') };
  let resolveSync!: (value: LearningStateSnapshot) => void;
  mockLoadCloudLearningState.mockImplementation(() => new Promise((resolve) => { resolveSync = resolve; }));

  const screen = renderProvider();

  await waitFor(() => expect(screen.getByTestId('initial-syncing').props.children).toBe('true'));
  expect(useAppStore.getState()).toMatchObject({ learningOwnerId: null, completedExpressionIds: [] });

  await act(async () => { resolveSync(cloudSnapshot({ currentExpressionId: 3 })); });
  expect(useAppStore.getState()).toMatchObject({ learningOwnerId: 'user-2', currentExpressionId: 3 });
});

it('동기화에 실패하면 잠시 뒤 자동으로 다시 시도한다', async () => {
  jest.useFakeTimers();
  seedSyncedDevice();
  mockAuth = { isReady: true, session: sessionFor('user-1') };
  mockLoadCloudLearningState
    .mockRejectedValueOnce(new Error('Network request failed'))
    .mockResolvedValueOnce(cloudSnapshot({ lastCompletedDate: todayKey(), currentExpressionId: 42 }));

  const screen = renderProvider();
  await act(async () => {});
  expect(screen.getByTestId('status').props.children).toBe('error');

  await act(async () => { jest.advanceTimersByTime(5_000); });
  await act(async () => {});

  expect(mockLoadCloudLearningState).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('status').props.children).toBe('synced');
  screen.unmount();
});
