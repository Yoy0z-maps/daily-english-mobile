import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } })
}));

jest.mock('@/store/useAppStore', () => {
  const storeState = {
    hasHydrated: true,
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
  loadCloudLearningState: jest.fn()
}));

import {
  LearningSyncProvider,
  useLearningSync
} from '@/sync/LearningSyncProvider';
import {
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
  });
});
