import { useAppStore } from '@/store/useAppStore';
import { createOptimisticCategory } from '@/sync/optimisticCategory';
import { createCloudCategory, saveContentToCategory } from '@/sync/learningSync';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }));
jest.mock('@/sync/learningSync', () => ({ createCloudCategory: jest.fn(), saveContentToCategory: jest.fn() }));
const createCategory = jest.mocked(createCloudCategory);
const save = jest.mocked(saveContentToCategory);

beforeEach(() => { useAppStore.getState().clearUserSession(); });

it('shows a category and membership before the request resolves, then replaces its temporary ID', async () => {
  let resolve!: (id: string) => void;
  createCategory.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  save.mockResolvedValueOnce(undefined);
  const mutation = createOptimisticCategory('user', ' Travel ', 3);
  expect(useAppStore.getState().savedCategories).toContainEqual(expect.objectContaining({ id: mutation.categoryId, name: 'Travel' }));
  expect(useAppStore.getState().savedExpressionCategoryIds['3']).toEqual([mutation.categoryId]);
  resolve('cloud-category-7');
  await mutation.settled;
  expect(useAppStore.getState().savedExpressionCategoryIds['3']).toEqual(['cloud-category-7']);
});

it('rolls back only the failed category, preserving unrelated changes', async () => {
  createCategory.mockRejectedValueOnce(new Error('offline'));
  const mutation = createOptimisticCategory('user', 'Travel', 3);
  useAppStore.getState().applyOptimisticCategoryToggle(4, 'default');
  await expect(mutation.settled).rejects.toThrow('offline');
  expect(useAppStore.getState().savedCategories).toHaveLength(1);
  expect(useAppStore.getState().savedExpressionCategoryIds).toEqual({ '4': ['default'] });
});

it('keeps the server-created category when saving its expression fails', async () => {
  createCategory.mockResolvedValueOnce('cloud-category-7');
  save.mockRejectedValueOnce(new Error('save failed'));
  const mutation = createOptimisticCategory('user', 'Travel', 3);
  await expect(mutation.settled).rejects.toThrow('save failed');
  expect(useAppStore.getState().savedCategories).toContainEqual(expect.objectContaining({ id: 'cloud-category-7' }));
  expect(useAppStore.getState().savedExpressionCategoryIds).toEqual({});
});

it('does not remove a pre-existing membership when saving to the same category', async () => {
  useAppStore.getState().applyOptimisticCategoryToggle(3, 'default');
  createCategory.mockResolvedValueOnce('default');
  await createOptimisticCategory('user', '기본', 3).settled;
  expect(useAppStore.getState().savedExpressionCategoryIds['3']).toEqual(['default']);
  expect(save).not.toHaveBeenCalled();
});

it('ignores responses from a previous session', async () => {
  let resolve!: (id: string) => void;
  createCategory.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const mutation = createOptimisticCategory('user', 'Travel', 3);
  useAppStore.getState().clearUserSession();
  resolve('cloud-category-7');
  await mutation.settled;
  expect(useAppStore.getState().savedCategories).toHaveLength(1);
  expect(save).not.toHaveBeenCalled();
});
