import { beginLearningMutation } from '@/sync/pendingMutations';
import { createOptimisticCategory } from '@/sync/optimisticCategory';
import { showToast } from '@/ui/Toast';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import {
  DEFAULT_SAVED_CATEGORY_ID,
  defaultSavedCategory,
  useAppStore
} from '@/store/useAppStore';
import { useLearningSync } from '@/sync/LearningSyncProvider';
import {
  removeContentFromCategory,
  saveContentToCategory
} from '@/sync/learningSync';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

type SaveToCategoryModalProps = {
  visible: boolean;
  expressionId: number;
  onClose: () => void;
};

export const SaveToCategoryModal = ({ visible, expressionId, onClose }: SaveToCategoryModalProps) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { session } = useAuth();
  const { syncNow } = useLearningSync();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const rawCategories = useAppStore((state) => state.savedCategories);
  const favoriteExpressionIds = useAppStore((state) => state.favoriteExpressionIds);
  const savedExpressionCategoryIds = useAppStore((state) => state.savedExpressionCategoryIds);
  const categories = useMemo(() => {
    const hasDefaultCategory = rawCategories.some((category) => category.id === DEFAULT_SAVED_CATEGORY_ID);
    return hasDefaultCategory ? rawCategories : [defaultSavedCategory, ...rawCategories];
  }, [rawCategories]);
  const savedCategoryIds = useMemo(() => {
    const directCategoryIds = savedExpressionCategoryIds[String(expressionId)] ?? [];

    if (directCategoryIds.length > 0) {
      return directCategoryIds;
    }

    return favoriteExpressionIds.includes(expressionId) ? [DEFAULT_SAVED_CATEGORY_ID] : [];
  }, [expressionId, favoriteExpressionIds, savedExpressionCategoryIds]);

  const refresh = () => { void syncNow().catch((error) => console.warn('저장 후 동기화에 실패했습니다.', error)); };

  const handleCategoryPress = async (categoryId: string, shouldSave = !savedCategoryIds.includes(categoryId), revision = useAppStore.getState().sessionRevision) => {
    if (!session || savingRef.current || useAppStore.getState().sessionRevision !== revision) return;
    savingRef.current = true;
    setIsSaving(true);
    const finishMutation = beginLearningMutation();
    const state = useAppStore.getState();
    const currentIds = state.savedExpressionCategoryIds[String(expressionId)] ??
      (state.favoriteExpressionIds.includes(expressionId) ? [DEFAULT_SAVED_CATEGORY_ID] : []);
    const snapshot = currentIds.includes(categoryId) !== shouldSave
      ? state.applyOptimisticCategoryToggle(expressionId, categoryId) : null;
    onClose();
    try {
      if (shouldSave) await saveContentToCategory(session.user.id, expressionId, categoryId, categories);
      else await removeContentFromCategory(session.user.id, expressionId, categoryId, categories);
      if (useAppStore.getState().sessionRevision === revision) {
        showToast(shouldSave ? '카테고리에 저장했어요.' : '카테고리에서 저장을 해제했어요.');
      }
    } catch {
      if (useAppStore.getState().sessionRevision === revision) {
        if (snapshot) useAppStore.getState().revertOptimisticCategoryToggle(snapshot);
        showToast('저장 위치를 변경하지 못했어요.', {
          label: '다시 시도', onPress: () => { void handleCategoryPress(categoryId, shouldSave, revision); }
        });
      }
    } finally {
      finishMutation();
      savingRef.current = false;
      setIsSaving(false);
      refresh();
    }
  };

  const handleCreateAndSave = async (name = newCategoryName, revision = useAppStore.getState().sessionRevision) => {
    if (!session || savingRef.current || useAppStore.getState().sessionRevision !== revision) return;
    if (!name.trim()) { showToast('카테고리 이름을 입력해주세요.'); return; }
    savingRef.current = true;
    setIsSaving(true);
    try {
      const mutation = createOptimisticCategory(session.user.id, name, expressionId);
      setNewCategoryName('');
      onClose();
      await mutation.settled;
      if (useAppStore.getState().sessionRevision === revision) showToast('카테고리에 저장했어요.');
    } catch {
      if (useAppStore.getState().sessionRevision === revision) {
        showToast('카테고리에 저장하지 못했어요.', {
          label: '다시 시도', onPress: () => { void handleCreateAndSave(name, revision); }
        });
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
      refresh();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>어디에 저장할까요?</Text>
          <Text style={styles.subtitle}>표현은 하나 이상의 카테고리에 저장할 수 있어요.</Text>

          <ScrollView style={styles.categoryList} contentContainerStyle={styles.categoryContent}>
            {categories.map((category) => {
              const isSelected = savedCategoryIds.includes(category.id);
              return (
                <Pressable
                  key={category.id}
                  style={[styles.categoryRow, isSelected && styles.categoryRowSelected]}
                  disabled={isSaving}
                  onPress={() => void handleCategoryPress(category.id)}
                >
                  <View style={styles.categoryIcon}>
                    <Text style={styles.categoryIconText}>{isSelected ? '✓' : '＋'}</Text>
                  </View>
                  <View style={styles.categoryTextGroup}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryHint}>{isSelected ? '저장됨 · 탭하면 해제' : '이 카테고리에 저장'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.createBox}>
            <TextInput
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="새 카테고리 이름"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <Pressable
              style={styles.createButton}
              disabled={isSaving}
              onPress={() => void handleCreateAndSave()}
            >
              <Text style={styles.createButtonText}>
                {isSaving ? '저장 중…' : '만들고 저장'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      top: 0
    },
    categoryContent: {
      gap: 10,
      paddingVertical: 4
    },
    categoryHint: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 3
    },
    categoryIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 34,
      justifyContent: 'center',
      width: 34
    },
    categoryIconText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '900'
    },
    categoryList: {
      maxHeight: 260,
      marginTop: 18
    },
    categoryName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900'
    },
    categoryRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      padding: 14
    },
    categoryRowSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    categoryTextGroup: {
      flex: 1
    },
    createBox: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 10,
      marginTop: 18,
      paddingTop: 16
    },
    createButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingVertical: 14
    },
    createButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900'
    },
    handle: {
      alignSelf: 'center',
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 5,
      marginBottom: 16,
      width: 42
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      paddingHorizontal: 14,
      paddingVertical: 13
    },
    overlay: {
      backgroundColor: 'rgba(0,0,0,0.38)',
      flex: 1,
      justifyContent: 'flex-end'
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 34,
      borderTopRightRadius: 34,
      padding: 22,
      paddingBottom: 28
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 21,
      marginTop: 6
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.5
    }
  });
