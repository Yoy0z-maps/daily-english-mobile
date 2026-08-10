import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  DEFAULT_SAVED_CATEGORY_ID,
  defaultSavedCategory,
  useAppStore
} from '@/store/useAppStore';
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
  const [newCategoryName, setNewCategoryName] = useState('');
  const rawCategories = useAppStore((state) => state.savedCategories);
  const favoriteExpressionIds = useAppStore((state) => state.favoriteExpressionIds);
  const savedExpressionCategoryIds = useAppStore((state) => state.savedExpressionCategoryIds);
  const saveExpressionToCategory = useAppStore((state) => state.saveExpressionToCategory);
  const removeExpressionFromCategory = useAppStore((state) => state.removeExpressionFromCategory);
  const createSavedCategory = useAppStore((state) => state.createSavedCategory);
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

  const handleCategoryPress = (categoryId: string) => {
    if (savedCategoryIds.includes(categoryId)) {
      removeExpressionFromCategory(expressionId, categoryId);
    } else {
      saveExpressionToCategory(expressionId, categoryId);
    }
    onClose();
  };

  const handleCreateAndSave = () => {
    const categoryId = createSavedCategory(newCategoryName);
    saveExpressionToCategory(expressionId, categoryId);
    setNewCategoryName('');
    onClose();
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
                  onPress={() => handleCategoryPress(category.id)}
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
            <Pressable style={styles.createButton} onPress={handleCreateAndSave}>
              <Text style={styles.createButtonText}>만들고 저장</Text>
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
