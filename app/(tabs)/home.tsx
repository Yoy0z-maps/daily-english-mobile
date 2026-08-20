import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '@/components/AdBanner';
import { ExpressionCard } from '@/components/ExpressionCard';
import { SaveToCategoryModal } from '@/components/SaveToCategoryModal';
import { StreakCard } from '@/components/StreakCard';
import { useContent } from '@/content/ContentProvider';
import {
  getLocalDateKey,
  selectIsExpressionSaved,
  useAppStore
} from '@/store/useAppStore';
import { useLearningSync } from '@/sync/LearningSyncProvider';
import { completeCurrentContent } from '@/sync/learningSync';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { reloadAllWidgets } from '@/widget/reloadWidgets';
import { saveWidgetExpressionData } from '@/widget/saveWidgetExpressionData';

const FREE_HISTORY_DAYS = 3;

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
  const { expressions, errorMessage: contentError, isLoading: isContentLoading, refresh } = useContent();
  const { isInitialSyncing, syncNow } = useLearningSync();
  const [categoryModalExpressionId, setCategoryModalExpressionId] = useState<number | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const currentExpressionId = useAppStore((state) => state.currentExpressionId);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const streak = useAppStore((state) => state.streak);
  const longestStreak = useAppStore((state) => state.longestStreak);
  const totalCompleted = useAppStore((state) => state.totalCompleted);
  const isPremium = useAppStore((state) => state.isPremium);
  const favoriteExpressionIds = useAppStore((state) => state.favoriteExpressionIds);
  const savedExpressionCategoryIds = useAppStore((state) => state.savedExpressionCategoryIds);
  const completedExpressionIds = useAppStore((state) => state.completedExpressionIds);
  const lastCompletedDate = useAppStore((state) => state.lastCompletedDate);
  const exactCurrentPosition = expressions.findIndex(
    (item) => item.id === currentExpressionId
  );
  const nextCurrentPosition = expressions.findIndex(
    (item) => item.id >= currentExpressionId
  );
  const currentPosition =
    exactCurrentPosition >= 0
      ? exactCurrentPosition
      : nextCurrentPosition >= 0
        ? nextCurrentPosition
        : Math.max(0, expressions.length - 1);
  const expression = expressions[currentPosition];
  const isSaved = useAppStore((state) =>
    selectIsExpressionSaved(state, expression?.id ?? -1)
  );
  const historyDays = Math.min(
    currentPosition,
    isPremium ? expressions.length - 1 : FREE_HISTORY_DAYS
  );
  const historyExpressions = Array.from({ length: historyDays }, (_, index) => {
    const daysAgo = index + 1;
    return {
      daysAgo,
      expression: expressions[currentPosition - daysAgo]
    };
  });

  const isCompletedToday =
    Boolean(expression) &&
    lastCompletedDate === getLocalDateKey() &&
    completedExpressionIds.includes(expression.id);

  useEffect(() => {
    if (!hasHydrated || !expression) {
      return;
    }

    void saveWidgetExpressionData(expression, streak).then(() => reloadAllWidgets());
  }, [expression, hasHydrated, streak]);

  const syncWidgetFromStore = async () => {
    if (!expression) {
      return;
    }

    const state = useAppStore.getState();
    await saveWidgetExpressionData(expression, state.streak);
    await reloadAllWidgets();
  };

  const handleCompleteToday = async () => {
    if (!expression || isCompletedToday || isCompleting) {
      return;
    }

    setIsCompleting(true);

    try {
      await completeCurrentContent(expression.id);
      await syncNow();
      await syncWidgetFromStore();
    } catch (error) {
      Alert.alert(
        '학습 완료 실패',
        error instanceof Error ? error.message : '학습 완료를 저장하지 못했습니다.'
      );
    } finally {
      setIsCompleting(false);
    }
  };

  if (isContentLoading || isInitialSyncing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.stateTitle}>학습 기록을 불러오는 중</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!expression || contentError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>학습 콘텐츠를 불러오지 못했어요</Text>
          <Text style={styles.stateText}>{contentError ?? '게시된 콘텐츠가 없습니다.'}</Text>
          <Pressable style={styles.retryButton} onPress={() => void refresh()}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {!isPremium && <AdBanner />}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>오늘의 1문장</Text>
          <Text style={styles.heroTitle}>오늘은 이 문장 하나만</Text>
        </View>

        <StreakCard
          streak={streak}
          longestStreak={longestStreak}
          completedCount={totalCompleted}
        />

        <ExpressionCard
          expression={expression}
          isFavorite={isSaved}
          onFavoritePress={() => setCategoryModalExpressionId(expression.id)}
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
          <Pressable
            style={styles.saveButton}
            onPress={() => setCategoryModalExpressionId(expression.id)}
          >
            <Ionicons
              color={colors.primary}
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={19}
            />
            <Text style={styles.saveButtonText}>{isSaved ? '저장 위치 변경' : '오늘 단어 저장하기'}</Text>
          </Pressable>
          <Pressable
            style={[styles.completeButton, isCompletedToday && styles.completeButtonDone]}
            disabled={isCompletedToday || isCompleting}
            onPress={handleCompleteToday}
          >
            <Ionicons
              color="#FFFFFF"
              name={isCompletedToday ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={20}
            />
            <Text style={styles.completeButtonText}>
              {isCompletedToday ? '오늘 학습 완료' : isCompleting ? '저장 중…' : '오늘 단어 학습 완료'}
            </Text>
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
                onFavoritePress={() => setCategoryModalExpressionId(historyExpression.id)}
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
        visible={categoryModalExpressionId !== null}
        expressionId={categoryModalExpressionId ?? expression.id}
        onClose={() => setCategoryModalExpressionId(null)}
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
    centeredState: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 28
    },
    completeButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 20,
      flex: 1,
      flexDirection: 'row',
      gap: 6,
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
    retryButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      marginTop: 18,
      paddingHorizontal: 20,
      paddingVertical: 12
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900'
    },
    stateText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 8,
      textAlign: 'center'
    },
    stateTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      marginTop: 14,
      textAlign: 'center'
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
      flexDirection: 'row',
      gap: 6,
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
