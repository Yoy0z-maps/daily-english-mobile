import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import type { EnglishExpression } from '@/types/expression';

type ExpressionCardProps = {
  expression: EnglishExpression;
  isFavorite?: boolean;
  onFavoritePress?: () => void;
  onOpenDetail?: () => void;
  compact?: boolean;
  saveLabel?: string;
  showSaveControls?: boolean;
  cardPressEnabled?: boolean;
  detailLabel?: string;
};

export const ExpressionCard = ({
  expression,
  isFavorite = false,
  onFavoritePress,
  onOpenDetail,
  compact = false,
  saveLabel,
  showSaveControls = true,
  cardPressEnabled = true,
  detailLabel = '자세히 보기'
}: ExpressionCardProps) => {
  const colors = useThemeColors();
  const styles = createStyles(colors, compact, isFavorite);

  return (
    <Pressable style={styles.card} onPress={cardPressEnabled ? onOpenDetail : undefined} disabled={!cardPressEnabled}>
      <View style={styles.topGlow} />
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{expression.category}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{expression.level}</Text>
          </View>
        </View>
        {showSaveControls ? (
          <Pressable style={styles.saveIconButton} onPress={onFavoritePress} disabled={!onFavoritePress}>
            <Text style={styles.saveIconText}>{isFavorite ? '♥' : '♡'}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.sentence}>{expression.sentence}</Text>
      <Text style={styles.meaning}>{expression.meaning}</Text>

      <View style={styles.keywordBox}>
        <Text style={styles.keywordLabel}>KEY EXPRESSION</Text>
        <Text style={styles.keyword}>{expression.keyword}</Text>
        <Text style={styles.keywordMeaning}>{expression.keywordMeaning}</Text>
      </View>

      {!compact && (
        <View style={styles.exampleBox}>
          <Text style={styles.example}>{expression.example}</Text>
          <Text style={styles.exampleMeaning}>{expression.exampleMeaning}</Text>
        </View>
      )}

      {showSaveControls ? (
        <View style={styles.actions}>
          <Pressable style={styles.favoriteButton} onPress={onFavoritePress} disabled={!onFavoritePress}>
            <Text style={styles.favoriteText}>{saveLabel ?? (isFavorite ? '저장됨 · 카테고리 변경' : '저장하기')}</Text>
          </Pressable>
          {onOpenDetail ? <Text style={styles.detailText}>{detailLabel} →</Text> : null}
        </View>
      ) : onOpenDetail ? (
        <Pressable style={styles.detailButton} onPress={onOpenDetail}>
          <Text style={styles.detailButtonText}>{detailLabel} →</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
};

const createStyles = (colors: AppTheme, compact: boolean, isFavorite: boolean) =>
  StyleSheet.create({
    actions: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 18
    },
    badge: {
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6
    },
    badgeRow: {
      flexDirection: 'row',
      gap: 8
    },
    badgeText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900'
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 28,
      borderWidth: 1,
      overflow: 'hidden',
      padding: compact ? 18 : 20,
      shadowColor: colors.cardShadow,
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 }
    },
    detailButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      marginTop: 18,
      paddingVertical: 13
    },
    detailButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '900'
    },
    detailText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '900'
    },
    example: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 23
    },
    exampleBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 20,
      gap: 8,
      marginTop: 16,
      padding: 15
    },
    exampleMeaning: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 21
    },
    favoriteButton: {
      backgroundColor: isFavorite ? colors.primarySoft : colors.primary,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10
    },
    favoriteText: {
      color: isFavorite ? colors.primary : '#FFFFFF',
      fontSize: 14,
      fontWeight: '900'
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16
    },
    keyword: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '900',
      marginTop: 5
    },
    keywordBox: {
      backgroundColor: colors.primarySoft,
      borderRadius: 20,
      marginTop: 18,
      padding: 15
    },
    keywordLabel: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1
    },
    keywordMeaning: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 4
    },
    levelBadge: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    levelText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '900'
    },
    meaning: {
      color: colors.textMuted,
      fontSize: compact ? 16 : 17,
      fontWeight: '800',
      lineHeight: compact ? 23 : 25,
      marginTop: 8
    },
    saveIconButton: {
      alignItems: 'center',
      backgroundColor: isFavorite ? colors.primary : colors.surfaceMuted,
      borderRadius: 999,
      height: 38,
      justifyContent: 'center',
      width: 38
    },
    saveIconText: {
      color: isFavorite ? '#FFFFFF' : colors.primary,
      fontSize: 18,
      fontWeight: '900'
    },
    sentence: {
      color: colors.text,
      fontSize: compact ? 24 : 30,
      fontWeight: '900',
      letterSpacing: -0.8,
      lineHeight: compact ? 31 : 37
    },
    topGlow: {
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 108,
      opacity: 0.38,
      position: 'absolute',
      right: -52,
      top: -66,
      width: 108
    }
  });
