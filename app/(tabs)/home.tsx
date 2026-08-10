import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '@/components/AdBanner';
import { ExpressionCard } from '@/components/ExpressionCard';
import { SaveToCategoryModal } from '@/components/SaveToCategoryModal';
import { mockExpressions } from '@/data/mockExpressions';
import {
  getLocalDateKey,
  selectCurrentExpression,
  selectExpressionForDaysAgo,
  selectIsExpressionSaved,
  useAppStore
} from '@/store/useAppStore';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { reloadAllWidgets } from '@/widget/reloadWidgets';
import { saveWidgetExpressionData } from '@/widget/saveWidgetExpressionData';

const FREE_HISTORY_DAYS = 3;
const PREMIUM_HISTORY_DAYS = Math.max(mockExpressions.length - 1, FREE_HISTORY_DAYS);

const getHistoryDateLabel = (daysAgo: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);

  if (daysAgo === 1) {
    return `어제 · ${date.getMonth() + 1}월 ${date.getDate()}일`;
  }

  return `${daysAgo}일 전 · ${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export default function HomeScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const expression = useAppStore(selectCurrentExpression);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const streak = useAppStore((state) => state.streak);
  const isPremium = useAppStore((state) => state.isPremium);
  const favoriteExpressionIds = useAppStore((state) => state.favoriteExpressionIds);
  const savedExpressionCategoryIds = useAppStore((state) => state.savedExpressionCategoryIds);
  const completedExpressionIds = useAppStore((state) => state.completedExpressionIds);
  const lastCompletedDate = useAppStore((state) => state.lastCompletedDate);
  const completeToday = useAppStore((state) => state.completeToday);
  const isSaved = useAppStore((state) => selectIsExpressionSaved(state, expression.id));
  const historyDays = isPremium ? PREMIUM_HISTORY_DAYS : FREE_HISTORY_DAYS;
  const historyExpressions = Array.from({ length: historyDays }, (_, index) => ({
    daysAgo: index + 1,
    expression: selectExpressionForDaysAgo(index + 1)
  }));

  const isCompletedToday = lastCompletedDate === getLocalDateKey() && completedExpressionIds.includes(expression.id);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    void saveWidgetExpressionData(expression, streak).then(() => reloadAllWidgets());
  }, [expression, hasHydrated, streak]);

  const syncWidgetFromStore = async () => {
    const state = useAppStore.getState();
    const todayExpression = selectCurrentExpression();
    await saveWidgetExpressionData(todayExpression, state.streak);
    await reloadAllWidgets();
  };

  const handleCompleteToday = async () => {
    completeToday();
    await syncWidgetFromStore();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!isPremium && <AdBanner />}

        <View style={styles.hero}>
          <Text style={styles.kicker}>오늘의 1문장</Text>
          <Text style={styles.heroTitle}>오늘은 이 문장 하나만</Text>
        </View>

        <ExpressionCard
          expression={expression}
          isFavorite={isSaved}
          onFavoritePress={() => setIsCategoryModalVisible(true)}
          showSaveControls={false}
          cardPressEnabled={false}
          detailLabel="오늘 문장 자세히 보기"
          onOpenDetail={() =>
            router.push({
              pathname: '/expression/[id]',
              params: { id: String(expression.id) }
            })
          }
        />

        <View style={styles.actionRow}>
          <Pressable style={styles.saveButton} onPress={() => setIsCategoryModalVisible(true)}>
            <Text style={styles.saveButtonText}>{isSaved ? '저장 위치 변경' : '오늘 단어 저장하기'}</Text>
          </Pressable>
          <Pressable
            style={[styles.completeButton, isCompletedToday && styles.completeButtonDone]}
            onPress={handleCompleteToday}
          >
            <Text style={styles.completeButtonText}>{isCompletedToday ? '학습완료' : '학습 완료'}</Text>
          </Pressable>
        </View>

        <View style={styles.historyHeader}>
          <View>
            <Text style={styles.historyKicker}>Previous sentences</Text>
            <Text style={styles.historyTitle}>이전 문장</Text>
          </View>
          <Text style={styles.historyHint}>아래로 내려서 확인해요</Text>
        </View>

        {historyExpressions.map(({ daysAgo, expression: historyExpression }) => {
          const historyExpressionIsSaved =
            favoriteExpressionIds.includes(historyExpression.id) ||
            (savedExpressionCategoryIds[String(historyExpression.id)]?.length ?? 0) > 0;

          return (
            <View key={daysAgo} style={styles.historyItem}>
              <Text style={styles.historyDate}>{getHistoryDateLabel(daysAgo)}</Text>
              <ExpressionCard
                compact
                expression={historyExpression}
                isFavorite={historyExpressionIsSaved}
                onFavoritePress={() => setIsCategoryModalVisible(true)}
                showSaveControls={false}
                cardPressEnabled={false}
                detailLabel="이전 문장 자세히 보기"
                onOpenDetail={() =>
                  router.push({
                    pathname: '/expression/[id]',
                    params: { id: String(historyExpression.id) }
                  })
                }
              />
            </View>
          );
        })}

        {!isPremium ? (
          <Pressable style={styles.historyLock} onPress={() => router.push('/(tabs)/settings')}>
            <Text style={styles.historyLockKicker}>Premium</Text>
            <Text style={styles.historyLockTitle}>3일보다 이전 문장도 이어서 보기</Text>
            <Text style={styles.historyLockText}>프로에서는 지난 문장을 제한 없이 둘러볼 수 있어요.</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <SaveToCategoryModal
        visible={isCategoryModalVisible}
        expressionId={expression.id}
        onClose={() => setIsCategoryModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    actionRow: {
      flexDirection: 'row',
      gap: 10
    },
    completeButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 20,
      flex: 1,
      justifyContent: 'center',
      minHeight: 54,
      paddingHorizontal: 14
    },
    completeButtonDone: {
      backgroundColor: colors.success
    },
    completeButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900'
    },
    content: {
      gap: 16,
      padding: 20,
      paddingBottom: 36
    },
    hero: {
      paddingVertical: 8
    },
    heroTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.5,
      marginTop: 3
    },
    kicker: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.7,
      textTransform: 'uppercase'
    },
    historyDate: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 10,
      marginLeft: 4
    },
    historyHeader: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16
    },
    historyHint: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 3
    },
    historyItem: {
      marginTop: 2
    },
    historyKicker: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.7,
      textTransform: 'uppercase'
    },
    historyLock: {
      backgroundColor: colors.primarySoft,
      borderRadius: 24,
      padding: 20
    },
    historyLockKicker: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    historyLockText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 21,
      marginTop: 6
    },
    historyLockTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '900',
      marginTop: 6
    },
    historyTitle: {
      color: colors.text,
      fontSize: 25,
      fontWeight: '900',
      letterSpacing: -0.6,
      marginTop: 3
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1
    },
    saveButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flex: 1.15,
      justifyContent: 'center',
      minHeight: 54,
      paddingHorizontal: 14
    },
    saveButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'center'
    }
  });
