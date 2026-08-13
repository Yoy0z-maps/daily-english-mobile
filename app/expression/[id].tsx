import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExpressionCard } from '@/components/ExpressionCard';
import { PremiumLockCard } from '@/components/PremiumLockCard';
import { SaveToCategoryModal } from '@/components/SaveToCategoryModal';
import { useContent } from '@/content/ContentProvider';
import { selectIsExpressionSaved, useAppStore } from '@/store/useAppStore';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import type { EnglishExpression } from '@/types/expression';

const situationByCategory: Record<EnglishExpression['category'], string[]> = {
  Daily: ['친구나 동료와 가볍게 말할 때', '부담 없이 의사를 전하고 싶을 때'],
  Business: ['회의나 메신저에서 짧게 답할 때', '상대에게 일정/업무 상황을 자연스럽게 전달할 때'],
  Travel: ['호텔, 카페, 공항처럼 바로 말해야 하는 상황', '정중하지만 너무 딱딱하지 않게 요청할 때'],
  Developer: ['버그 리포트, 코드 리뷰, 제품 논의 중', '문제를 설명하거나 해결 방향을 물어볼 때'],
  OPIc: ['경험을 말하면서 자연스럽게 이유를 붙일 때', '답변을 길게 이어가기 전에 핵심 문장을 던질 때']
};

const getExtraExamples = (expression: EnglishExpression) => [
  {
    sentence: expression.example,
    meaning: expression.exampleMeaning
  },
  ...(expression.extraExamples?.length
    ? expression.extraExamples
    : [
        {
          sentence: `${expression.sentence} I'll keep you posted.`,
          meaning: `${expression.meaning} 진행 상황도 알려드릴게요.`
        }
      ])
];

const getToneTip = (expression: EnglishExpression) => {
  if (expression.toneTip) {
    return expression.toneTip;
  }

  if (expression.category === 'Business') {
    return '업무 상황에서는 문장 끝에 “after I check”나 “by tomorrow”처럼 시간 표현을 붙이면 더 신뢰감 있게 들려요.';
  }

  if (expression.category === 'Travel') {
    return '여행 중에는 “Could I…”나 “Can I…”처럼 시작하면 짧아도 충분히 정중하게 들립니다.';
  }

  if (expression.category === 'Developer') {
    return '개발 대화에서는 원인보다 현재 증상과 다음 액션을 먼저 말하면 훨씬 명확해져요.';
  }

  if (expression.category === 'OPIc') {
    return 'OPIc 답변에서는 이 문장을 말한 뒤 개인 경험을 하나 붙이면 답변이 자연스럽게 길어집니다.';
  }

  return '캐주얼한 대화에서는 너무 길게 설명하기보다 이 문장을 먼저 말하고, 필요하면 한 문장만 덧붙이면 자연스러워요.';
};

export default function ExpressionDetailScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { expressions, getExpressionById } = useContent();
  const params = useLocalSearchParams<{ id: string }>();
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const id = Number(params.id ?? 0);
  const expression = getExpressionById(id) ?? expressions[0];
  const isFavorite = useAppStore((state) => selectIsExpressionSaved(state, expression.id));
  const isPremium = useAppStore((state) => state.isPremium);
  const situations = expression.usageSituations?.length
    ? expression.usageSituations
    : situationByCategory[expression.category];
  const extraExamples = useMemo(() => getExtraExamples(expression), [expression]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: expression.sentence }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ExpressionCard
          expression={expression}
          isFavorite={isFavorite}
          onFavoritePress={() => setIsCategoryModalVisible(true)}
        />

        <View style={styles.detailCard}>
          <Text style={styles.sectionKicker}>Usage</Text>
          <Text style={styles.sectionTitle}>언제 쓰면 좋을까요?</Text>
          {situations.map((situation) => (
            <View key={situation} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bodyText}>{situation}</Text>
            </View>
          ))}
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.sectionKicker}>Examples</Text>
          <Text style={styles.sectionTitle}>조금 더 말해보기</Text>
          {extraExamples.map((item) => (
            <View key={item.sentence} style={styles.exampleRow}>
              <Text style={styles.exampleSentence}>{item.sentence}</Text>
              <Text style={styles.exampleMeaning}>{item.meaning}</Text>
            </View>
          ))}
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.sectionKicker}>Speaking tip</Text>
          <Text style={styles.sectionTitle}>말할 때 느낌</Text>
          <Text style={styles.bodyText}>{getToneTip(expression)}</Text>
          <View style={styles.metaPill}>
            <Text style={styles.metaText}>{expression.category} · {expression.level}</Text>
          </View>
        </View>

        {isPremium ? (
          <View style={styles.aiCard}>
            <Text style={styles.sectionKicker}>AI Coach</Text>
            <Text style={styles.aiTitle}>AI 설명</Text>
            <Text style={styles.bodyText}>
              {expression.aiExplanation ??
                `“${expression.keyword}”는 문장 안에서 핵심 행동을 부드럽게 만들어주는 표현이에요. 전체 문장을 외운 뒤 주어와 목적어만 바꿔 말하면 실제 대화에서 바로 재사용할 수 있습니다.`}
            </Text>
            <View style={styles.patternBox}>
              <Text style={styles.patternLabel}>Pattern</Text>
              <Text style={styles.patternText}>{expression.sentence.replace(expression.keyword, `[${expression.keyword}]`)}</Text>
            </View>
          </View>
        ) : (
          <PremiumLockCard
            title="AI 설명은 프리미엄 기능이에요"
            description="표현의 뉘앙스, 대체 문장, 실수하기 쉬운 포인트는 Premium Mock을 켜면 볼 수 있어요."
          />
        )}
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
    aiCard: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: 28,
      borderWidth: 1,
      padding: 20
    },
    aiTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.5,
      marginBottom: 10,
      marginTop: 6
    },
    bodyText: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 24
    },
    bulletDot: {
      color: colors.primary,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 24,
      width: 18
    },
    bulletRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10
    },
    content: {
      gap: 16,
      padding: 20,
      paddingBottom: 36
    },
    detailCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: 1,
      padding: 18
    },
    exampleMeaning: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 21,
      marginTop: 5
    },
    exampleRow: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      marginTop: 10,
      padding: 14
    },
    exampleSentence: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 23
    },
    metaPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      marginTop: 14,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    metaText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900'
    },
    patternBox: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      marginTop: 14,
      padding: 14
    },
    patternLabel: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    patternText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      marginTop: 6
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1
    },
    sectionKicker: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3,
      marginTop: 6
    }
  });
