import { beginLearningMutation } from '@/sync/pendingMutations';
import { showToast } from '@/ui/Toast';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '@/components/AdBanner';
import { ExpressionCard } from '@/components/ExpressionCard';
import { SaveToCategoryModal } from '@/components/SaveToCategoryModal';
import { StreakCard } from '@/components/StreakCard';
import { useContent } from '@/content/ContentProvider';
import {
  getLocalDateKey,
  selectEffectiveIsPremium,
  selectIsExpressionSaved,
  useAppStore
} from '@/store/useAppStore';
import { useLearningSync } from '@/sync/LearningSyncProvider';
import { completeCurrentContent, type CompletedHistoryEntry } from '@/sync/learningSync';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { reloadAllWidgets } from '@/widget/reloadWidgets';
import { saveWidgetExpressionData } from '@/widget/saveWidgetExpressionData';

const FREE_HISTORY_DAYS = 3;

const getHistoryDateLabel = (daysAgo: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);

  if (daysAgo <= 1) {
    return `어제 · ${date.getMonth() + 1}월 ${date.getDate()}일`;
  }

  return `${daysAgo}일 전 · ${date.getMonth() + 1}월 ${date.getDate()}일`;
};

// completed_date("YYYY-MM-DD")와 오늘 사이의 일수 차이를 구한다. 완료 기록의 실제 날짜를 라벨에 반영하기 위함.
const getDaysAgo = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const completedDate = new Date(year, (month ?? 1) - 1, day ?? 1);
  completedDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.max(1, Math.round((today.getTime() - completedDate.getTime()) / (24 * 60 * 60 * 1000)));
};

type HistoryItem = { expressionId: number; daysAgo: number };

export default function HomeScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const {
    expressions,
    errorMessage: contentError,
    isLoading: isContentLoading,
    refresh,
    getExpressionById
  } = useContent();
  const { isInitialSyncing, syncNow } = useLearningSync();
  const [categoryModalExpressionId, setCategoryModalExpressionId] = useState<number | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const storedCurrentExpressionId = useAppStore((state) => state.currentExpressionId);
  const isAdminMode = useAppStore((state) => state.isAdminMode);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const streak = useAppStore((state) => state.streak);
  const longestStreak = useAppStore((state) => state.longestStreak);
  const totalCompleted = useAppStore((state) => state.totalCompleted);
  const isPremium = useAppStore(selectEffectiveIsPremium);
  // 어드민(심사용) 모드에서는 항상 가장 최신 문장을 오늘의 문장으로 보여주고, 나머지는 전부 이전 문장으로 열람 가능하게 한다.
  const latestExpressionId =
    expressions.length > 0 ? expressions[expressions.length - 1].id : storedCurrentExpressionId;
  const currentExpressionId = isAdminMode ? latestExpressionId : storedCurrentExpressionId;
  const favoriteExpressionIds = useAppStore((state) => state.favoriteExpressionIds);
  const savedExpressionCategoryIds = useAppStore((state) => state.savedExpressionCategoryIds);
  const completedExpressionIds = useAppStore((state) => state.completedExpressionIds);
  const completedHistory = useAppStore((state) => state.completedHistory);
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
  // "이전 문장"은 콘텐츠 목록 위치가 아니라 실제로 학습 완료한 기록(completedHistory)만 최신순으로 보여준다.
  // 어드민(심사용) 모드는 실제 완료 기록이 없으므로, 최신 문장을 제외한 나머지를 전부 이전 문장으로 보여준다.
  const pastHistory: HistoryItem[] = isAdminMode
    ? expressions
        .filter((item) => item.id !== currentExpressionId)
        .slice()
        .reverse()
        .map((item, index) => ({ expressionId: item.id, daysAgo: index + 1 }))
    : completedHistory
        .filter((entry: CompletedHistoryEntry) => entry.expressionId !== currentExpressionId)
        .map((entry) => ({ expressionId: entry.expressionId, daysAgo: getDaysAgo(entry.completedDate) }));
  const visibleHistoryCount = isPremium
    ? pastHistory.length
    : Math.min(pastHistory.length, FREE_HISTORY_DAYS);
  const visibleHistory = pastHistory.slice(0, visibleHistoryCount);

  const isCompletedToday =
    Boolean(expression) &&
    lastCompletedDate === getLocalDateKey() &&
    completedExpressionIds.includes(expression.id);

  useEffect(() => {
    if (!hasHydrated || !expression) {
      return;
    }

    void saveWidgetExpressionData(expression, streak, {
      lastCompletedDate,
      nextExpression: !isAdminMode && completedExpressionIds.includes(expression.id)
        ? expressions[currentPosition + 1]
        : undefined
    }).then(() => reloadAllWidgets());
  }, [expression, hasHydrated, streak, lastCompletedDate, completedExpressionIds, expressions, currentPosition, isAdminMode]);

  const syncWidgetFromStore = async () => {
    if (!expression) {
      return;
    }

    const state = useAppStore.getState();
    await saveWidgetExpressionData(expression, state.streak, {
      lastCompletedDate: state.lastCompletedDate,
      nextExpression: !state.isAdminMode && state.completedExpressionIds.includes(expression.id)
        ? expressions[currentPosition + 1]
        : undefined
    });
    await reloadAllWidgets();
  };

  const handleCompleteToday = async () => {
    if (!expression || isCompletedToday || isCompleting) {
      return;
    }

    setIsCompleting(true);
    // 낙관적 업데이트: 서버 응답을 기다리지 않고 먼저 완료 상태로 표시하고, 실패하면 이전 상태로 되돌린다.
    const finishMutation = beginLearningMutation();
    const sessionRevision = useAppStore.getState().sessionRevision;
    const snapshot = useAppStore.getState().applyOptimisticCompletion(expression.id);

    try {
      await completeCurrentContent(expression.id);
    } catch (error) {
      // 완료 요청 자체가 실패한 경우에만 되돌린다.
      if (useAppStore.getState().sessionRevision === sessionRevision) {
        useAppStore.getState().revertOptimisticCompletion(snapshot);
        showToast('학습 완료를 저장하지 못해 되돌렸어요. 다시 시도해주세요.');
      }
      setIsCompleting(false);
      return;
    } finally {
      finishMutation();
    }

    try {
      // 완료는 서버에 이미 반영됐으므로, 이후 동기화가 실패해도 낙관적 상태는 되돌리지 않는다.
      await syncNow();
      await syncWidgetFromStore();
    } catch (error) {
      console.warn('학습 완료 후 동기화에 실패했습니다.', error);
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

        {visibleHistory.length === 0 ? (
          <Text style={styles.historyEmptyText}>아직 이전에 학습한 문장이 없어요.</Text>
        ) : (
          visibleHistory.map(({ expressionId, daysAgo }) => {
            const historyExpression = getExpressionById(expressionId);

            if (!historyExpression) {
              return null;
            }

            const historyExpressionIsSaved =
              favoriteExpressionIds.includes(historyExpression.id) ||
              (savedExpressionCategoryIds[String(historyExpression.id)]?.length ?? 0) > 0;

            return (
              <View key={historyExpression.id} style={styles.historyItem}>
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
          })
        )}

        {!isPremium && pastHistory.length > visibleHistoryCount ? (
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
    historyEmptyText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      paddingVertical: 12,
      textAlign: 'center'
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
