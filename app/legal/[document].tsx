import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isLegalDocumentId, legalDocuments } from '@/legal/documents';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

export default function LegalDocumentScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const params = useLocalSearchParams<{ document?: string | string[] }>();
  const rawDocumentId = Array.isArray(params.document) ? params.document[0] : params.document;
  const document = rawDocumentId && isLegalDocumentId(rawDocumentId)
    ? legalDocuments[rawDocumentId]
    : null;

  const openExternalPolicy = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('링크 열기 실패', '외부 개인정보처리방침을 열지 못했습니다.');
    }
  };

  if (!document) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: '법적 고지' }} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>문서를 찾지 못했습니다</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: document.title }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.kicker}>Daily English · Legal</Text>
          <Text style={styles.title}>{document.title}</Text>
          <Text style={styles.summary}>{document.summary}</Text>
          <View style={styles.dateBox}>
            <Text style={styles.dateText}>공고일 {document.announcedAt}</Text>
            <Text style={styles.dateText}>시행일 {document.effectiveAt}</Text>
          </View>
        </View>

        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs?.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
            ))}
            {section.bullets?.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <Text style={styles.bulletMarker}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
            {section.links?.map((link) => (
              <Pressable
                key={link.url}
                accessibilityRole="link"
                style={styles.linkButton}
                onPress={() => void openExternalPolicy(link.url)}
              >
                <Text style={styles.linkText}>{link.label}</Text>
                <Text style={styles.linkArrow}>↗</Text>
              </Pressable>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>오늘의 문장 · Daily English Sentence</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    backButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      marginTop: 18,
      paddingHorizontal: 18,
      paddingVertical: 12
    },
    backButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900'
    },
    bulletMarker: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 23
    },
    bulletRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 8,
      marginTop: 9
    },
    bulletText: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 23
    },
    content: {
      gap: 14,
      padding: 20,
      paddingBottom: 44
    },
    dateBox: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 3,
      marginTop: 20,
      paddingTop: 14
    },
    dateText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700'
    },
    emptyState: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 24
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900'
    },
    footer: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      paddingVertical: 12,
      textAlign: 'center'
    },
    headerCard: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: 1,
      padding: 20
    },
    kicker: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase'
    },
    linkArrow: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '900'
    },
    linkButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingHorizontal: 13,
      paddingVertical: 11
    },
    linkText: {
      color: colors.primary,
      flex: 1,
      fontSize: 13,
      fontWeight: '900'
    },
    paragraph: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 23,
      marginTop: 10
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1
    },
    section: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      padding: 18
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
      lineHeight: 24
    },
    summary: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 23,
      marginTop: 10
    },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: -0.8,
      marginTop: 6
    }
  });
