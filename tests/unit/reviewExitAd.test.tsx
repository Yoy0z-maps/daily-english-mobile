import { act, renderHook } from '@testing-library/react-native';
import { useReviewExitAd } from '@/ads/useReviewExitAd';

const mockDispatch = jest.fn();
const mockNavigation = { dispatch: mockDispatch };
let mockPrevent: (event: any) => void;
let mockBlocked = false;
let mockListener: (event: any) => void;
let mockPremium = false;
const mockAd = { load: jest.fn(), show: jest.fn(), addAdEventsListener: jest.fn((listener) => { mockListener = listener; return jest.fn(); }) };
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => mockNavigation,
  usePreventRemove: (blocked: boolean, callback: any) => { mockBlocked = blocked; mockPrevent = callback; }
}));
jest.mock('react-native-google-mobile-ads', () => ({
  RewardedAd: { createForAdRequest: () => mockAd },
  AdEventType: { CLOSED: 'closed', ERROR: 'error' },
  RewardedAdEventType: { LOADED: 'loaded' }
}));
jest.mock('@/ads/adUnits', () => ({ rewardedAdUnitId: 'test' }));
jest.mock('@/ads/AdMobProvider', () => ({ useAdMob: () => ({ isReady: true }) }));
jest.mock('@/store/useAppStore', () => ({ useAppStore: () => mockPremium, selectEffectiveIsPremium: jest.fn() }));

beforeEach(() => { mockPremium = false; mockAd.show.mockResolvedValue(undefined); });

it('preloads silently and skips an unavailable ad without showing it later', () => {
  const { result } = renderHook(() => useReviewExitAd(true));
  const next = jest.fn();
  expect(mockAd.load).toHaveBeenCalledTimes(1);
  expect(mockAd.show).not.toHaveBeenCalled();
  act(() => result.current(next));
  expect(next).toHaveBeenCalledTimes(1);
  act(() => mockListener({ type: 'loaded' }));
  expect(mockAd.show).not.toHaveBeenCalled();
});

it('shows once at completion, continues after close without requiring a reward', () => {
  const { result } = renderHook(() => useReviewExitAd(true));
  const next = jest.fn();
  act(() => mockListener({ type: 'loaded' }));
  act(() => { result.current(next); result.current(next); });
  expect(mockAd.show).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
  act(() => mockListener({ type: 'closed' }));
  expect(next).toHaveBeenCalledTimes(1);
  expect(mockBlocked).toBe(false);
  act(() => result.current(jest.fn()));
  expect(mockAd.show).toHaveBeenCalledTimes(1);
});

it('resumes a back action after ad failure', () => {
  renderHook(() => useReviewExitAd(true));
  act(() => mockListener({ type: 'loaded' }));
  const action = { type: 'GO_BACK' };
  act(() => mockPrevent({ data: { action } }));
  expect(mockDispatch).not.toHaveBeenCalled();
  act(() => mockListener({ type: 'error' }));
  expect(mockDispatch).toHaveBeenCalledWith(action);
  expect(mockBlocked).toBe(false);
});

it('continues when native show rejects', async () => {
  mockAd.show.mockRejectedValue(new Error('show failed'));
  const { result } = renderHook(() => useReviewExitAd(true));
  const next = jest.fn();
  act(() => mockListener({ type: 'loaded' }));
  await act(async () => result.current(next));
  expect(next).toHaveBeenCalledTimes(1);
});

it('does not load or show ads for premium users', () => {
  mockPremium = true;
  const { result } = renderHook(() => useReviewExitAd(true));
  const next = jest.fn();
  act(() => result.current(next));
  expect(mockAd.load).not.toHaveBeenCalled();
  expect(mockAd.show).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
});
