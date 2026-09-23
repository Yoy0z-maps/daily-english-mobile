import { act, fireEvent, render } from '@testing-library/react-native';
import { showToast, Toast } from '@/ui/Toast';
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

it('keeps retry visible longer and invokes it only once', () => {
  jest.useFakeTimers();
  const retry = jest.fn();
  const screen = render(<Toast />);
  act(() => showToast('저장 실패', { label: '다시 시도', onPress: retry }));
  act(() => jest.advanceTimersByTime(4500));
  const button = screen.getByRole('button', { name: '다시 시도' });
  fireEvent.press(button);
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('저장 실패')).toBeNull();
  act(() => showToast('저장 성공'));
  expect(screen.queryByText('다시 시도')).toBeNull();
  act(() => jest.advanceTimersByTime(4500));
  expect(screen.queryByText('저장 성공')).toBeNull();
  jest.useRealTimers();
});
