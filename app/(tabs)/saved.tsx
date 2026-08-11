import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRewardedAd } from 'react-native-google-mobile-ads';

import { useAdMob } from '@/ads/AdMobProvider';
import { rewardedAdUnitId } from '@/ads/adUnits';
import { ExpressionCard } from '@/components/ExpressionCard';
import { mockExpressions } from '@/data/mockExpressions';
import {
  DEFAULT_SAVED_CATEGORY_ID,
  defaultSavedCategory,
  useAppStore
} from '@/store/useAppStore';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

export default function SavedScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { isReady: isAdMobReady } = useAdMob();
  const [selectedCategoryId, setSelectedCategoryId] = useState(DEFAULT_SAVED_CATEGORY_ID);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const rawCategories = useAppStore((state) => state.savedCategories);
  const isPremium = useAppStore((state) => state.isPremium);
  const wrongAnswerCount = useAppStore((state) => state.wrongAnswerExpressionIds.length);
  const favoriteExpressionIds = useAppStore((state) => state.favoriteExpressionIds);
  const savedExpressionCategoryIds = useAppStore((state) => state.savedExpressionCategoryIds);
  const createSavedCategory = useAppStore((state) => state.createSavedCategory);
  const removeExpressionFromCategory = useAppStore((state) => state.removeExpressionFromCategory);
  const categories = useMemo(() => {
    const hasDefaultCategory = rawCategories.some((category) => category.id === DEFAULT_SAVED_CATEGORY_ID);
    return hasDefaultCategory ? rawCategories : [defaultSavedCategory, ...rawCategories];
  }, [rawCategories]);
  const savedExpressionIds = useMemo(() => {
    const ids = new Set<number>();

    Object.entries(savedExpressionCategoryIds).forEach(([id, categoryIds]) => {
      if (categoryIds.includes(selectedCategoryId)) {
        ids.add(Number(id));
      }
    });

    if (selectedCategoryId === DEFAULT_SAVED_CATEGORY_ID) {
      favoriteExpressionIds.forEach((id) => ids.add(id));
    }

    return Array.from(ids).filter((id) => Number.isFinite(id));
  }, [favoriteExpressionIds, savedExpressionCategoryIds, selectedCategoryId]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? categories[0];
  const expressions = useMemo(
    () => mockExpressions.filter((expression) => savedExpressionIds.includes(expression.id)),
    [savedExpressionIds]
  );
  const pendingReviewCategoryId = useRef<string | null>(null);
  const rewardedAd = useRewardedAd(!isPremium && isAdMobReady ? rewardedAdUnitId : null);

  useEffect(() => {
    if (!isPremium && isAdMobReady) {
      rewardedAd.load();
    }
  }, [isAdMobReady, isPremium, rewardedAd.load]);

  useEffect(() => {
    if (!rewardedAd.isClosed) {
      return;
    }

    const categoryId = pendingReviewCategoryId.current;
    pendingReviewCategoryId.current = null;

    if (rewardedAd.isEarnedReward && categoryId) {
      router.push({ pathname: '/review', params: { categoryId } });
    }

    if (!isPremium && isAdMobReady) {
      rewardedAd.load();
    }
  }, [isAdMobReady, isPremium, rewardedAd.isClosed, rewardedAd.isEarnedReward, rewardedAd.load]);

  useEffect(() => {
    if (!rewardedAd.error) {
      return;
    }

    console.warn('리워드 광고를 불러오지 못했습니다.', rewardedAd.error);

    if (pendingReviewCategoryId.current) {
      pendingReviewCategoryId.current = null;
      Alert.alert('광고를 불러오지 못했어요', '네트워크 상태를 확인한 뒤 다시 시도해주세요.');

      if (!isPremium && isAdMobReady) {
        rewardedAd.load();
      }
    }
  }, [isAdMobReady, isPremium, rewardedAd.error, rewardedAd.load]);

  const handleCreateCategory = () => {
    const categoryId = createSavedCategory(newCategoryName);
    setSelectedCategoryId(categoryId);
    setNewCategoryName('');
    setIsCreateModalVisible(false);
  };

  const handleReviewPress = () => {
    if (expressions.length === 0) {
      Alert.alert('복습할 문장이 없어요', '먼저 Home에서 문장을 저장해주세요.');
      return;
    }

    if (isPremium) {
      router.push({ pathname: '/review', params: { categoryId: selectedCategoryId } });
      return;
    }

    if (!isAdMobReady || !rewardedAd.isLoaded) {
      Alert.alert('광고 준비 중', '리워드 광고를 불러오는 중입니다. 잠시 후 다시 눌러주세요.');

      if (isAdMobReady) {
        rewardedAd.load();
      }

      return;
    }

    pendingReviewCategoryId.current = selectedCategoryId;
    rewardedAd.show();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Saved library</Text>
          <Text style={styles.title}>내 문장 보관함</Text>
          <Text style={styles.subtitle}>카테고리별로 저장하고, 모아둔 표현으로 바로 복습해요.</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.reviewButton}
            onPress={handleReviewPress}
          >
            <Text style={styles.reviewButtonText}>
              {isPremium ? '복습하기' : rewardedAd.isLoaded ? '광고 보고 복습하기' : '광고 준비 중…'}
            </Text>
          </Pressable>
          <Pressable style={styles.noteButton} onPress={() => router.push('/wrong-note')}>
            <Text style={styles.noteButtonText}>오답노트 {wrongAnswerCount}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.addCategoryButton} onPress={() => setIsCreateModalVisible(true)}>
          <Text style={styles.addCategoryButtonText}>＋ 새 카테고리 만들기</Text>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabs}>
          {categories.map((category) => {
            const isSelected = category.id === selectedCategoryId;
            return (
              <Pressable
                key={category.id}
                style={[styles.categoryTab, isSelected && styles.categoryTabSelected]}
                onPress={() => setSelectedCategoryId(category.id)}
              >
                <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextSelected]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{selectedCategory.name}</Text>
          <Text style={styles.sectionCount}>{expressions.length} saved</Text>
        </View>

        {expressions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>이 카테고리는 아직 비어있어요</Text>
            <Text style={styles.emptyText}>Home에서 저장 버튼을 누르고 저장할 카테고리를 선택해보세요.</Text>
          </View>
        ) : (
          expressions.map((expression) => (
            <ExpressionCard
              key={expression.id}
              compact
              expression={expression}
              isFavorite
              saveLabel="이 카테고리에서 제거"
              onFavoritePress={() => removeExpressionFromCategory(expression.id, selectedCategoryId)}
              onOpenDetail={() =>
                router.push({
                  pathname: '/expression/[id]',
                  params: { id: String(expression.id) }
                })
              }
            />
          ))
        )}
      </ScrollView>

      <Modal visible={isCreateModalVisible} transparent animationType="fade" onRequestClose={() => setIsCreateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsCreateModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>새 카테고리 만들기</Text>
            <TextInput
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="예: 여행 회화, 회사 영어"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <Pressable style={styles.modalButton} onPress={handleCreateCategory}>
              <Text style={styles.modalButtonText}>카테고리 추가</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    actionRow: {
      flexDirection: 'row',
      gap: 10
    },
    addCategoryButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      paddingVertical: 13
    },
    addCategoryButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '900'
    },
    categoryTab: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 10
    },
    categoryTabSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    categoryTabText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '900'
    },
    categoryTabTextSelected: {
      color: '#FFFFFF'
    },
    categoryTabs: {
      gap: 10,
      paddingRight: 20
    },
    content: {
      gap: 16,
      padding: 20,
      paddingBottom: 36
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 28,
      borderWidth: 1,
      padding: 28
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
      textAlign: 'center'
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900'
    },
    header: {
      marginBottom: 2,
      marginTop: 8
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 16,
      paddingHorizontal: 14,
      paddingVertical: 14
    },
    kicker: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    modalBackdrop: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      top: 0
    },
    modalButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 18,
      marginTop: 14,
      paddingVertical: 14
    },
    modalButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900'
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      margin: 20,
      padding: 20,
      width: '90%'
    },
    modalOverlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.38)',
      flex: 1,
      justifyContent: 'center'
    },
    modalTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900'
    },
    noteButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flex: 1,
      paddingVertical: 14
    },
    noteButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '900'
    },
    reviewButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 20,
      flex: 1,
      paddingVertical: 14
    },
    reviewButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900'
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1
    },
    sectionCount: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800'
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 2
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900'
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 24,
      marginTop: 6
    },
    title: {
      color: colors.text,
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1,
      marginTop: 4
    }
  });
