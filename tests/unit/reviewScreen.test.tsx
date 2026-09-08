import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ReviewScreen from '../../app/review';
import { loadReviewQueue, prepareReviewAnswerIds, submitReviewAnswer } from '@/sync/learningSync';
import { showToast } from '@/ui/Toast';

jest.mock('expo-router', () => ({ router: { back: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('@/content/ContentProvider', () => ({ useContent: () => ({ expressions: [
  { id: 1, sentence: 'Hello', meaning: '안녕', keywordMeaning: '인사', exampleMeaning: '인사해요' },
  { id: 2, sentence: 'Bye', meaning: '잘 가' },
  { id: 3, sentence: 'Thanks', meaning: '고마워' },
  { id: 4, sentence: 'Sorry', meaning: '미안해' }
] }) }));
jest.mock('@/store/useAppStore', () => ({ useAppStore: (selector: any) => selector({ completedExpressionIds: [1, 2, 3, 4] }) }));
jest.mock('@/sync/LearningSyncProvider', () => ({ useLearningSync: () => ({ syncNow: jest.fn().mockResolvedValue(undefined) }) }));
jest.mock('@/theme/useThemeColors', () => ({ useThemeColors: () => ({}) }));
jest.mock('@/ui/Toast', () => ({ showToast: jest.fn() }));
jest.mock('@/sync/learningSync', () => ({ loadReviewQueue: jest.fn(), prepareReviewAnswerIds: jest.fn(), submitReviewAnswer: jest.fn() }));

it('prefetches IDs and displays feedback immediately; a failed save restores the question', async () => {
  jest.mocked(loadReviewQueue).mockResolvedValue([{ expressionId: 1, isWrongNote: false, correctStreak: 0 }]);
  jest.mocked(prepareReviewAnswerIds).mockResolvedValue(new Map([[1, 101]]));
  let reject!: (error: Error) => void;
  jest.mocked(submitReviewAnswer).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  const screen = render(<ReviewScreen />);
  await waitFor(() => expect(screen.getByText('Hello')).toBeTruthy());
  expect(prepareReviewAnswerIds).toHaveBeenCalled();
  fireEvent.press(screen.getByText('Hello'));
  expect(screen.getByText('정답이에요!')).toBeTruthy();
  fireEvent.press(screen.getByText('결과 보기'));
  expect(screen.queryByText('Review complete')).toBeNull();
  await act(async () => { reject(new Error('offline')); });
  expect(screen.queryByText('정답이에요!')).toBeNull();
  expect(showToast).toHaveBeenCalled();
  jest.mocked(submitReviewAnswer).mockResolvedValue({ mastered: false, correctStreak: 0, wrongNoteStatus: 'none' });
  fireEvent.press(screen.getByText('Hello'));
  await waitFor(() => expect(submitReviewAnswer).toHaveBeenCalledTimes(2));
  await act(async () => {});
  fireEvent.press(screen.getByText('결과 보기'));
  expect(screen.getByText('1 / 1')).toBeTruthy();
});
