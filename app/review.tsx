import { showToast } from '@/ui/Toast';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useContent } from '@/content/ContentProvider';
import { buildReviewOptions } from '@/learning/reviewPolicy';
import { useAppStore } from '@/store/useAppStore';
import { useLearningSync } from '@/sync/LearningSyncProvider';
import {
  loadReviewQueue,
  prepareReviewAnswerIds,
  submitReviewAnswer,
  type ReviewAnswerResult,
  type ReviewQueueItem
} from '@/sync/learningSync';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

export default function ReviewScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { expressions: publishedExpressions } = useContent();
  const { syncNow } = useLearningSync();
  const completedExpressionIds = useAppStore((state) => state.completedExpressionIds);
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<ReviewAnswerResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const submittingRef = useRef(false);
  const preparedIdsRef = useRef(new Map<number, number>());

  useEffect(() => {
    let isActive = true;

    void loadReviewQueue()
      .then((items) => {
        if (isActive) {
          setQueue(items);
          setErrorMessage(null);
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            error instanceof Error ? error.message : '복습 문제를 불러오지 못했습니다.'
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const learnedExpressions = useMemo(
    () => publishedExpressions.filter((expression) => completedExpressionIds.includes(expression.id)),
    [completedExpressionIds, publishedExpressions]
  );
  const reviewExpressions = useMemo(
    () =>
      queue
        .map((item) => publishedExpressions.find((expression) => expression.id === item.expressionId))
        .filter((expression): expression is NonNullable<typeof expression> => Boolean(expression)),
    [publishedExpressions, queue]
  );
  const currentExpression = reviewExpressions[currentIndex];
  const currentQueueItem = queue.find((item) => item.expressionId === currentExpression?.id);
  const options = useMemo(
    () =>
      currentExpression
        ? buildReviewOptions(
            currentExpression,
            currentIndex,
            learnedExpressions,
            publishedExpressions
          )
        : [],
    [currentExpression, currentIndex, learnedExpressions, publishedExpressions]
  );
  const isFinished = reviewExpressions.length > 0 && currentIndex >= reviewExpressions.length;

  useEffect(() => {
    let active = true;
    preparedIdsRef.current = new Map();
    if (currentExpression) {
      void prepareReviewAnswerIds([currentExpression.id, ...options.map((option) => option.id)])
        .then((ids) => { if (active) preparedIdsRef.current = ids; })
        .catch(() => { /* Submission falls back to resolving missing IDs. */ });
    }
    return () => { active = false; };
  }, [currentExpression, options]);

  const handleSelect = async (id: number) => {
    if (selectedId !== null || !currentExpression || submittingRef.current) return;
    const isCorrect = id === currentExpression.id;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSelectedId(id);
    setErrorMessage(null);
    if (isCorrect) setScore((value) => value + 1);

    try {
      const result = await submitReviewAnswer(currentExpression.id, id, isCorrect, preparedIdsRef.current);
      setAnswerResult(result);
      // Refresh the dashboard without delaying feedback or the next question.
      void syncNow();
    } catch (error) {
      setSelectedId(null);
      setAnswerResult(null);
      if (isCorrect) setScore((value) => value - 1);
      showToast('복습 결과를 저장하지 못해 선택을 되돌렸어요. 다시 선택해주세요.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (submittingRef.current || selectedId === null) return;
    setSelectedId(null);
    setAnswerResult(null);
    setErrorMessage(null);
    setCurrentIndex((index) => index + 1);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Review' }} />
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.emptyText}>오답을 우선으로 복습 문제를 준비하고 있어요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (reviewExpressions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Review' }} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>
            {errorMessage ? '복습 문제를 불러오지 못했어요' : '복습할 문장이 없어요'}
          </Text>
          <Text style={styles.emptyText}>
            {errorMessage ?? 'Home에서 오늘 단어 학습을 먼저 완료해주세요.'}
          </Text>
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
          <Text style={styles.resultTitle}>{score} / {reviewExpressions.length}</Text>
          <Text style={styles.emptyText}>
            최대 5문제 복습을 마쳤어요. 틀린 표현은 자동으로 오답노트에 추가됐습니다.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>돌아가기</Text>
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
          <Text style={styles.kicker}>
            {currentQueueItem?.isWrongNote ? '오답 우선 복습' : '학습 표현 복습'}
          </Text>
          <Text style={styles.title}>뜻에 맞는 문장을 고르세요</Text>
          <Text style={styles.progress}>{currentIndex + 1} / {reviewExpressions.length}</Text>
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
                disabled={selectedId !== null || isSubmitting}
                style={[styles.optionButton, isCorrect && styles.correctOption, isWrong && styles.wrongOption]}
                onPress={() => void handleSelect(option.id)}
              >
                <Text style={[styles.optionText, (isCorrect || isWrong) && styles.optionTextActive]}>
                  {option.sentence}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {selectedId !== null ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>
              {selectedId === currentExpression.id ? '정답이에요!' : '아쉬워요. 정답을 확인해보세요'}
            </Text>
            <Text style={styles.feedbackText}>
              {answerResult?.mastered
                ? '오답을 2회 연속 맞혀 마스터했습니다.'
                : currentQueueItem?.isWrongNote && selectedId === currentExpression.id
                  ? `마스터까지 정답 ${Math.max(0, 2 - (answerResult?.correctStreak ?? ((currentQueueItem?.correctStreak ?? 0) + 1)))}회 남았어요.`
                  : `${currentExpression.sentence} · ${currentExpression.exampleMeaning}`}
            </Text>
            <Pressable disabled={isSubmitting} style={[styles.primaryButton, isSubmitting && { opacity: 0.6 }]} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>
                {currentIndex + 1 === reviewExpressions.length ? '결과 보기' : '다음 문제'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, gap: 18, padding: 20 },
    correctOption: { backgroundColor: colors.success, borderColor: colors.success },
    emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: '700', lineHeight: 24, marginTop: 10, textAlign: 'center' },
    emptyTitle: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.7, textAlign: 'center' },
    emptyWrap: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
    errorText: { color: colors.danger, fontSize: 13, fontWeight: '800', textAlign: 'center' },
    feedbackCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 26, borderWidth: 1, padding: 18 },
    feedbackText: { color: colors.textMuted, fontSize: 15, fontWeight: '700', lineHeight: 23, marginBottom: 16, marginTop: 8 },
    feedbackTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
    header: { marginTop: 8 },
    keywordHint: { color: colors.primary, fontSize: 14, fontWeight: '900', marginTop: 14 },
    kicker: { color: colors.primary, fontSize: 13, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
    optionButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, padding: 17 },
    optionText: { color: colors.text, fontSize: 16, fontWeight: '900', lineHeight: 23 },
    optionTextActive: { color: '#FFFFFF' },
    options: { gap: 12 },
    primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 18, marginTop: 18, paddingHorizontal: 18, paddingVertical: 14 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    progress: { color: colors.textMuted, fontSize: 14, fontWeight: '800', marginTop: 7 },
    questionCard: { backgroundColor: colors.primarySoft, borderRadius: 28, padding: 22 },
    questionLabel: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
    questionText: { color: colors.text, fontSize: 23, fontWeight: '900', lineHeight: 32, marginTop: 10 },
    resultTitle: { color: colors.primary, fontSize: 44, fontWeight: '900', marginTop: 12 },
    safeArea: { backgroundColor: colors.background, flex: 1 },
    title: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.6, marginTop: 6 },
    wrongOption: { backgroundColor: colors.danger, borderColor: colors.danger }
  });
