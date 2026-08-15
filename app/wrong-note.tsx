import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExpressionCard } from '@/components/ExpressionCard';
import { useContent } from '@/content/ContentProvider';
import { useAppStore } from '@/store/useAppStore';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

export default function WrongNoteScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { expressions: publishedExpressions } = useContent();
  const wrongAnswerExpressionIds = useAppStore((state) => state.wrongAnswerExpressionIds);
  const expressions = useMemo(
    () => publishedExpressions.filter((expression) => wrongAnswerExpressionIds.includes(expression.id)),
    [publishedExpressions, wrongAnswerExpressionIds]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: '오답노트' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Wrong note</Text>
          <Text style={styles.title}>다시 볼 표현</Text>
          <Text style={styles.subtitle}>복습 퀴즈에서 틀린 표현이 자동으로 모입니다.</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{expressions.length}</Text>
          <Text style={styles.summaryLabel}>개 표현이 오답노트에 있어요</Text>
          {expressions.length > 0 ? (
            <Text style={styles.masteryHint}>복습에서 2회 연속 정답을 맞히면 자동으로 마스터됩니다.</Text>
          ) : null}
        </View>

        {expressions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>아직 오답이 없어요</Text>
            <Text style={styles.emptyText}>Saved에서 복습하기를 풀면 틀린 표현이 여기에 쌓입니다.</Text>
          </View>
        ) : (
          expressions.map((expression) => (
            <ExpressionCard
              key={expression.id}
              compact
              expression={expression}
              showSaveControls={false}
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
    </SafeAreaView>
  );
}

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    content: {
      gap: 16,
      padding: 20,
      paddingBottom: 36
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: 1,
      padding: 26
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: '700',
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
      marginTop: 8
    },
    masteryHint: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 20,
      marginTop: 10
    },
    kicker: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 23,
      marginTop: 6
    },
    summaryCard: {
      backgroundColor: colors.primarySoft,
      borderRadius: 26,
      padding: 20
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 4
    },
    summaryValue: {
      color: colors.text,
      fontSize: 44,
      fontWeight: '900',
      letterSpacing: -1
    },
    title: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -0.9,
      marginTop: 4
    }
  });
