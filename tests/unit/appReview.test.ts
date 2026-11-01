import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import { useAppStore } from '@/store/useAppStore';
import { maybeRequestStoreReview } from '@/support/appReview';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  requestReview: jest.fn().mockResolvedValue(undefined)
}));

const DAY_MS = 24 * 60 * 60 * 1000;

describe('maybeRequestStoreReview', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useAppStore.setState({ isAdminMode: false, totalCompleted: 3 });
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const run = async () => {
    const promise = maybeRequestStoreReview();
    await jest.runAllTimersAsync();
    await promise;
  };

  it('학습을 3번 이상 완료했고 요청한 적이 없으면 리뷰를 요청한다', async () => {
    await run();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('daily-english-review-prompted-at-v1', expect.any(String));
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('완료 횟수가 부족하면 요청하지 않는다', async () => {
    useAppStore.setState({ totalCompleted: 2 });
    await run();

    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('심사용 어드민 모드에서는 요청하지 않는다', async () => {
    useAppStore.setState({ isAdminMode: true });
    await run();

    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('마지막 요청 후 60일이 지나지 않았으면 요청하지 않는다', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(String(Date.now() - 59 * DAY_MS));
    await run();

    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('마지막 요청 후 60일이 지나면 다시 요청한다', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(String(Date.now() - 61 * DAY_MS));
    await run();

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('기기에서 인앱 리뷰를 지원하지 않으면 스토어로 이동시키지 않고 건너뛴다', async () => {
    jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(false);
    await run();

    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('daily-english-review-prompted-at-v1', expect.any(String));
  });
});
