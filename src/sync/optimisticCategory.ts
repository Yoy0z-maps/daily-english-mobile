import * as Crypto from 'expo-crypto';
import { useAppStore } from '@/store/useAppStore';
import { createCloudCategory, saveContentToCategory } from '@/sync/learningSync';
import { beginLearningMutation } from '@/sync/pendingMutations';

export function createOptimisticCategory(userId: string, rawName: string, expressionId?: number) {
  const name = rawName.trim();
  if (!name) throw new Error('카테고리 이름을 입력해주세요.');
  const state = useAppStore.getState();
  const existing = state.savedCategories.find((category) => category.name === name);
  const category = existing ?? { id: `pending-${Crypto.randomUUID()}`, name, createdAt: new Date().toISOString() };
  const key = String(expressionId);
  const alreadySaved = state.savedExpressionCategoryIds[key]?.includes(category.id);
  const isCurrentSession = () => useAppStore.getState().sessionRevision === state.sessionRevision;
  const finish = beginLearningMutation();
  if (!existing) useAppStore.setState({ savedCategories: [...state.savedCategories, category] });
  if (expressionId !== undefined && !alreadySaved) {
    useAppStore.getState().applyOptimisticCategoryToggle(expressionId, category.id);
  }
  const replaceCategory = (nextId: string | null) => {
    if (!isCurrentSession()) return;
    useAppStore.setState((current) => {
      const memberships = Object.fromEntries(Object.entries(current.savedExpressionCategoryIds).map(([id, ids]) => [
        id, [...new Set(ids.flatMap((value) => value === category.id ? nextId ? [nextId] : [] : [value]))]
      ]).filter(([, ids]) => ids.length > 0));
      return {
        savedCategories: nextId
          ? current.savedCategories.map((item) => item.id === category.id ? { ...item, id: nextId } : item)
          : current.savedCategories.filter((item) => item.id !== category.id),
        savedExpressionCategoryIds: memberships,
        favoriteExpressionIds: Object.keys(memberships).map(Number)
      };
    });
  };
  const settled = (async () => {
    let cloudId: string | null = null;
    try {
      cloudId = await createCloudCategory(userId, name);
      if (!isCurrentSession()) return cloudId;
      replaceCategory(cloudId);
      if (expressionId !== undefined && !alreadySaved) {
        await saveContentToCategory(userId, expressionId, cloudId, [{ ...category, id: cloudId }]);
      }
      return cloudId;
    } catch (error) {
      if (isCurrentSession()) {
        if (!cloudId && !existing) replaceCategory(null);
        else if (expressionId !== undefined && !alreadySaved) {
          const id = cloudId ?? category.id;
          if (useAppStore.getState().savedExpressionCategoryIds[key]?.includes(id)) {
            useAppStore.getState().applyOptimisticCategoryToggle(expressionId, id);
          }
        }
      }
      throw error;
    } finally { finish(); }
  })();
  return { categoryId: category.id, settled };
}
