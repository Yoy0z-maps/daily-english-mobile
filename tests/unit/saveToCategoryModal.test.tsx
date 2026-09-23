jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { act, fireEvent, render } from '@testing-library/react-native';
import { SaveToCategoryModal } from '@/components/SaveToCategoryModal';
import { useAppStore, defaultSavedCategory } from '@/store/useAppStore';
import { createCloudCategory, saveContentToCategory } from '@/sync/learningSync';
import { showToast } from '@/ui/Toast';

const mockSync = jest.fn().mockResolvedValue(undefined);
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'user' } } }) }));
jest.mock('@/sync/LearningSyncProvider', () => ({ useLearningSync: () => ({ syncNow: mockSync }) }));
jest.mock('@/theme/useThemeColors', () => ({ useThemeColors: () => ({}) }));
jest.mock('@/ui/Toast', () => ({ showToast: jest.fn() }));
jest.mock('@/sync/learningSync', () => ({ saveContentToCategory: jest.fn(), removeContentFromCategory: jest.fn(), createCloudCategory: jest.fn() }));

it('closes and updates immediately, rolls back failure and retries the original save', async () => {
  useAppStore.setState({ savedCategories: [defaultSavedCategory], savedExpressionCategoryIds: {}, favoriteExpressionIds: [] });
  let reject!: (error: Error) => void;
  jest.mocked(saveContentToCategory).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const onClose = jest.fn();
  const screen = render(<SaveToCategoryModal visible expressionId={1} onClose={onClose} />);
  fireEvent.press(screen.getByText(defaultSavedCategory.name));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(useAppStore.getState().favoriteExpressionIds).toContain(1);
  await act(async () => reject(new Error('offline')));
  expect(useAppStore.getState().favoriteExpressionIds).not.toContain(1);
  const action = jest.mocked(showToast).mock.calls.at(-1)?.[1];
  expect(action?.label).toBe('다시 시도');
  jest.mocked(saveContentToCategory).mockResolvedValue(undefined);
  await act(async () => action?.onPress());
  expect(saveContentToCategory).toHaveBeenCalledTimes(2);
  expect(useAppStore.getState().favoriteExpressionIds).toContain(1);
  expect(showToast).toHaveBeenLastCalledWith('카테고리에 저장했어요.');
});


it('retries creating and saving with the original category name', async () => {
  useAppStore.setState({ savedCategories: [defaultSavedCategory], savedExpressionCategoryIds: {}, favoriteExpressionIds: [] });
  jest.mocked(createCloudCategory).mockRejectedValueOnce(new Error('offline')).mockResolvedValue('cloud-id');
  jest.mocked(saveContentToCategory).mockResolvedValue(undefined);
  const onClose = jest.fn();
  const screen = render(<SaveToCategoryModal visible expressionId={2} onClose={onClose} />);
  fireEvent.changeText(screen.getByPlaceholderText('새 카테고리 이름'), '여행');
  fireEvent.press(screen.getByText('만들고 저장'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(useAppStore.getState().favoriteExpressionIds).toContain(2);
  await act(async () => {});
  expect(useAppStore.getState().favoriteExpressionIds).not.toContain(2);
  const action = jest.mocked(showToast).mock.calls.at(-1)?.[1];
  await act(async () => action?.onPress());
  expect(createCloudCategory).toHaveBeenLastCalledWith('user', '여행');
  expect(useAppStore.getState().savedExpressionCategoryIds['2']).toEqual(['cloud-id']);
  expect(showToast).toHaveBeenLastCalledWith('카테고리에 저장했어요.');
});
