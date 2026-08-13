import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useContent } from '@/content/ContentProvider';
import {
  DEFAULT_SAVED_CATEGORY_ID,
  defaultSavedCategory,
  useAppStore
} from '@/store/useAppStore';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import type { EnglishExpression } from '@/types/expression';

const buildOptions = (
  correct: EnglishExpression,
  index: number,
  publishedExpressions: EnglishExpression[]
) => {
  const distractors = publishedExpressions
    .filter((expression) => expression.id !== correct.id)
    .sort((a, b) => ((a.id + 3) * (index + 5)) % 17 - (((b.id + 3) * (index + 5)) % 17))
    .slice(0, 3);

  return [correct, ...distractors].sort(
    (a, b) => ((a.id + 11) * (index + 7)) % 19 - (((b.id + 11) * (index + 7)) % 19)
  );
};

export default function ReviewScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { expressions: publishedExpressions } = useContent();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const categoryId = params.categoryId ?? DEFAULT_SAVED_CATEGORY_ID;
  const recordReviewAnswer = useAppStore((state) => state.recordReviewAnswer);
  const rawCategories = useAppStore((state) => state.savedCategories);
  const favoriteExpressionIds = useAppStore((state) => state.favoriteExpressionIds);
  const savedExpressionCategoryIds = useAppStore((state) => state.savedExpressionCategoryIds);
  const categories = useMemo(() => {
    const hasDefaultCategory = rawCategories.some((item) => item.id === DEFAULT_SAVED_CATEGORY_ID);
    return hasDefaultCategory ? rawCategories : [defaultSavedCategory, ...rawCategories];
  }, [rawCategories]);
  const savedExpressionIds = useMemo(() => {
    const ids = new Set<number>();

    Object.entries(savedExpressionCategoryIds).forEach(([id, categoryIds]) => {
      if (categoryIds.includes(categoryId)) {
        ids.add(Number(id));
      }
    });

    if (categoryId === DEFAULT_SAVED_CATEGORY_ID) {
      favoriteExpressionIds.forEach((id) => ids.add(id));
    }

    return Array.from(ids).filter((id) => Number.isFinite(id));
  }, [categoryId, favoriteExpressionIds, savedExpressionCategoryIds]);
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const expressions = useMemo(
    () => publishedExpressions.filter((expression) => savedExpressionIds.includes(expression.id)),
    [publishedExpressions, savedExpressionIds]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const currentExpression = expressions[currentIndex];
  const options = useMemo(
    () =>
      currentExpression
        ? buildOptions(currentExpression, currentIndex, publishedExpressions)
        : [],
    [currentExpression, currentIndex, publishedExpressions]
  );
  const isFinished = expressions.length > 0 && currentIndex >= expressions.length;

  const handleSelect = (id: number) => {
    if (selectedId !== null || !currentExpression) {
      return;
    }

    const isCorrect = id === currentExpression.id;
    setSelectedId(id);
    recordReviewAnswer(currentExpression.id, isCorrect, id);

    if (isCorrect) {
      setScore((value) => value + 1);
    }
  };

  const handleNext = () => {
    setSelectedId(null);
    setCurrentIndex((index) => index + 1);
  };

  if (expressions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Review' }} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>복습할 문장이 없어요</Text>
          <Text style={styles.emptyText}>Saved에서 표현을 먼저 카테고리에 저장해보세요.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isFinished) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Review' }} />
        <View style={styles.emptyWrap}>
          <Text style={styles.kicker}>Review complete</Text>
          <Text style={styles.resultTitle}>{score} / {expressions.length}</Text>
          <Text style={styles.emptyText}>{category.name} 카테고리 복습을 마쳤어요. 틀린 표현은 다시 저장해두고 반복해봐요.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Saved로 돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Review' }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>{category.name}</Text>
          <Text style={styles.title}>뜻에 맞는 문장을 고르세요</Text>
          <Text style={styles.progress}>{currentIndex + 1} / {expressions.length}</Text>
        </View>

        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>Korean meaning</Text>
          <Text style={styles.questionText}>{currentExpression.meaning}</Text>
          <Text style={styles.keywordHint}>Hint · {currentExpression.keywordMeaning}</Text>
        </View>

        <View style={styles.options}>
          {options.map((option) => {
            const isSelected = selectedId === option.id;
            const isCorrect = selectedId !== null && option.id === currentExpression.id;
            const isWrong = isSelected && option.id !== currentExpression.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.optionButton, isCorrect && styles.correctOption, isWrong && styles.wrongOption]}
                onPress={() => handleSelect(option.id)}
              >
                <Text style={[styles.optionText, (isCorrect || isWrong) && styles.optionTextActive]}>{option.sentence}</Text>
              </Pressable>
            );
          })}
        </View>

        {selectedId !== null ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>{selectedId === currentExpression.id ? '정답이에요!' : '아쉽지만 괜찮아요'}</Text>
            <Text style={styles.feedbackText}>{currentExpression.sentence} · {currentExpression.exampleMeaning}</Text>
            <Pressable style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>{currentIndex + 1 === expressions.length ? '결과 보기' : '다음 문제'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: 18,
      padding: 20
    },
    correctOption: {
      backgroundColor: colors.success,
      borderColor: colors.success
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 24,
      marginTop: 10,
      textAlign: 'center'
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.7,
      textAlign: 'center'
    },
    emptyWrap: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 24
    },
    feedbackCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: 1,
      padding: 18
    },
    feedbackText: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 23,
      marginBottom: 16,
      marginTop: 8
    },
    feedbackTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900'
    },
    header: {
      marginTop: 8
    },
    keywordHint: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '900',
      marginTop: 14
    },
    kicker: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    optionButton: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      padding: 17
    },
    optionText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 23
    },
    optionTextActive: {
      color: '#FFFFFF'
    },
    options: {
      gap: 12
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 20,
      marginTop: 18,
      paddingHorizontal: 28,
      paddingVertical: 15
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900'
    },
    progress: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '900',
      marginTop: 10
    },
    questionCard: {
      backgroundColor: colors.primarySoft,
      borderRadius: 30,
      padding: 22
    },
    questionLabel: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    questionText: {
      color: colors.text,
      fontSize: 27,
      fontWeight: '900',
      letterSpacing: -0.7,
      lineHeight: 35,
      marginTop: 12
    },
    resultTitle: {
      color: colors.text,
      fontSize: 56,
      fontWeight: '900',
      letterSpacing: -1.5,
      marginTop: 8
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1
    },
    title: {
      color: colors.text,
      fontSize: 31,
      fontWeight: '900',
      letterSpacing: -1,
      lineHeight: 38,
      marginTop: 6
    },
    wrongOption: {
      backgroundColor: colors.danger,
      borderColor: colors.danger
    }
  });
