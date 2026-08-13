import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import { mockExpressions } from '@/data/mockExpressions';
import { supabase } from '@/lib/supabase';
import type { EnglishExpression, ExpressionCategory } from '@/types/expression';

const CONTENT_CACHE_KEY = 'daily-english-published-contents-v1';
const VALID_CATEGORIES = new Set<ExpressionCategory>([
  'Daily',
  'Business',
  'Travel',
  'Developer',
  'OPIc'
]);
const VALID_LEVELS = new Set<EnglishExpression['level']>(['A2', 'B1', 'B2', 'C1']);

type ContentRow = {
  content_index: number | null;
  sentence: string;
  meaning: string;
  keyword: string | null;
  keyword_meaning: string | null;
  example: string | null;
  example_meaning: string | null;
  level: string | null;
  category: string | null;
  usage_situations: unknown;
  extra_examples: unknown;
  tone_tip: string | null;
  ai_explanation: string | null;
};

type ContentContextValue = {
  expressions: EnglishExpression[];
  isLoading: boolean;
  errorMessage: string | null;
  refresh: () => Promise<void>;
  getExpressionById: (id: number) => EnglishExpression | undefined;
};

const ContentContext = createContext<ContentContextValue | null>(null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const parseExtraExamples = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.sentence !== 'string' || typeof item.meaning !== 'string') {
      return [];
    }

    return [{ sentence: item.sentence, meaning: item.meaning }];
  });
};

const toExpression = (row: ContentRow): EnglishExpression | null => {
  if (
    row.content_index === null ||
    !Number.isFinite(row.content_index) ||
    !row.sentence?.trim() ||
    !row.meaning?.trim()
  ) {
    return null;
  }

  const category = VALID_CATEGORIES.has(row.category as ExpressionCategory)
    ? (row.category as ExpressionCategory)
    : 'Daily';
  const level = VALID_LEVELS.has(row.level as EnglishExpression['level'])
    ? (row.level as EnglishExpression['level'])
    : 'B1';

  return {
    id: Math.trunc(row.content_index),
    sentence: row.sentence.trim(),
    meaning: row.meaning.trim(),
    keyword: row.keyword?.trim() || row.sentence.trim(),
    keywordMeaning: row.keyword_meaning?.trim() || row.meaning.trim(),
    example: row.example?.trim() || row.sentence.trim(),
    exampleMeaning: row.example_meaning?.trim() || row.meaning.trim(),
    level,
    category,
    usageSituations: parseStringArray(row.usage_situations),
    extraExamples: parseExtraExamples(row.extra_examples),
    toneTip: row.tone_tip,
    aiExplanation: row.ai_explanation
  };
};

const parseCachedExpressions = (value: string | null) => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    return parsed as EnglishExpression[];
  } catch {
    return null;
  }
};

export function ContentProvider({ children }: PropsWithChildren) {
  const [expressions, setExpressions] = useState<EnglishExpression[]>(mockExpressions);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('contents')
      .select(
        'content_index, sentence, meaning, keyword, keyword_meaning, example, example_meaning, level, category, usage_situations, extra_examples, tone_tip, ai_explanation'
      )
      .eq('status', 'published')
      .order('content_index', { ascending: true });

    if (error) {
      throw error;
    }

    const nextExpressions = ((data ?? []) as ContentRow[])
      .map(toExpression)
      .filter((item): item is EnglishExpression => item !== null);

    if (nextExpressions.length === 0) {
      throw new Error('게시된 학습 콘텐츠가 없습니다.');
    }

    setExpressions(nextExpressions);
    setErrorMessage(null);

    try {
      await AsyncStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(nextExpressions));
    } catch (cacheError) {
      console.warn('학습 콘텐츠 캐시를 저장하지 못했습니다.', cacheError);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const cachedExpressions = parseCachedExpressions(
          await AsyncStorage.getItem(CONTENT_CACHE_KEY)
        );

        if (isActive && cachedExpressions) {
          setExpressions(cachedExpressions);
        }

        await refresh();
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error ? error.message : '학습 콘텐츠를 불러오지 못했습니다.'
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [refresh]);

  const expressionById = useMemo(
    () => new Map(expressions.map((expression) => [expression.id, expression])),
    [expressions]
  );
  const value = useMemo<ContentContextValue>(
    () => ({
      expressions,
      isLoading,
      errorMessage,
      refresh,
      getExpressionById: (id) => expressionById.get(id)
    }),
    [errorMessage, expressionById, expressions, isLoading, refresh]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export const useContent = () => {
  const context = useContext(ContentContext);

  if (!context) {
    throw new Error('useContent는 ContentProvider 안에서 사용해야 합니다.');
  }

  return context;
};
