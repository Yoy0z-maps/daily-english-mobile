import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CANDIDATES_PER_ATTEMPT = 20;
const FINAL_CONTENT_COUNT = 8;
const MAX_GENERATION_ATTEMPTS = 3;
const EMBEDDING_DIMENSIONS = 1536;
const OPENAI_API_URL = 'https://api.openai.com/v1';
const GENERATION_MODEL = Deno.env.get('OPENAI_GENERATION_MODEL') ?? 'gpt-5.6-sol';
const EMBEDDING_MODEL = Deno.env.get('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
const SIMILARITY_THRESHOLD = Math.min(
  1,
  Math.max(0, Number(Deno.env.get('CONTENT_SIMILARITY_THRESHOLD') ?? '0.93'))
);

const LEVELS = ['A2', 'B1', 'B2', 'C1'] as const;
const CATEGORIES = ['Daily', 'Business', 'Travel', 'Developer', 'OPIc'] as const;

type Level = (typeof LEVELS)[number];
type Category = (typeof CATEGORIES)[number];

type GeneratedCandidate = {
  sentence: string;
  meaning: string;
  keyword: string;
  keyword_meaning: string;
  example: string;
  example_meaning: string;
  level: Level;
  category: Category;
  intent_en: string;
  usage_situations: string[];
  extra_examples: Array<{ sentence: string; meaning: string }>;
  tone_tip: string;
  ai_explanation: string;
  quiz: {
    question_ko: string;
    correct_answer: string;
    distractors: string[];
  };
};

type CandidateWithEmbedding = GeneratedCandidate & {
  normalized_sentence: string;
  normalized_keyword: string;
  embedding: number[];
  similar_content_id: number | null;
  similarity_score: number | null;
};

type ExistingContent = {
  id: number;
  sentence: string;
  normalized_sentence: string;
  keyword: string | null;
  normalized_keyword: string | null;
  example: string | null;
  embedding: number[] | string | null;
};

type RejectionCounts = Record<
  'invalid' | 'keyword' | 'sentence' | 'database_similarity' | 'batch_similarity',
  number
>;

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8'
};

const contentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      minItems: CANDIDATES_PER_ATTEMPT,
      maxItems: CANDIDATES_PER_ATTEMPT,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'sentence',
          'meaning',
          'keyword',
          'keyword_meaning',
          'example',
          'example_meaning',
          'level',
          'category',
          'intent_en',
          'usage_situations',
          'extra_examples',
          'tone_tip',
          'ai_explanation',
          'quiz'
        ],
        properties: {
          sentence: { type: 'string', minLength: 3, maxLength: 120 },
          meaning: { type: 'string', minLength: 2, maxLength: 160 },
          keyword: { type: 'string', minLength: 1, maxLength: 60 },
          keyword_meaning: { type: 'string', minLength: 1, maxLength: 120 },
          example: { type: 'string', minLength: 3, maxLength: 180 },
          example_meaning: { type: 'string', minLength: 2, maxLength: 220 },
          level: { type: 'string', enum: LEVELS },
          category: { type: 'string', enum: CATEGORIES },
          intent_en: { type: 'string', minLength: 3, maxLength: 220 },
          usage_situations: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: { type: 'string', minLength: 2, maxLength: 120 }
          },
          extra_examples: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['sentence', 'meaning'],
              properties: {
                sentence: { type: 'string', minLength: 3, maxLength: 180 },
                meaning: { type: 'string', minLength: 2, maxLength: 220 }
              }
            }
          },
          tone_tip: { type: 'string', minLength: 3, maxLength: 300 },
          ai_explanation: { type: 'string', minLength: 10, maxLength: 600 },
          quiz: {
            type: 'object',
            additionalProperties: false,
            required: ['question_ko', 'correct_answer', 'distractors'],
            properties: {
              question_ko: { type: 'string', minLength: 2, maxLength: 180 },
              correct_answer: { type: 'string', minLength: 3, maxLength: 120 },
              distractors: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'string', minLength: 3, maxLength: 120 }
              }
            }
          }
        }
      }
    }
  }
};

const normalizeWhitespace = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ');

const normalizeSentence = (value: string) =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[.!?]+$/g, '');

const normalizeKeyword = (value: string) => normalizeWhitespace(value).toLowerCase();

const parseEmbedding = (value: number[] | string | null) => {
  if (Array.isArray(value)) {
    return value.map(Number);
  }

  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(Number) : null;
  } catch {
    return null;
  }
};

const cosineSimilarity = (left: number[], right: number[]) => {
  if (left.length !== right.length || left.length === 0) {
    return -1;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return -1;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const constantTimeEqual = (left: string, right: string) => {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
};

const getKoreanDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const getResponseText = (payload: Record<string, unknown>) => {
  const output = Array.isArray(payload.output) ? payload.output : [];

  for (const item of output) {
    if (typeof item !== 'object' || item === null || !('content' in item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (
        typeof content === 'object' &&
        content !== null &&
        'type' in content &&
        content.type === 'output_text' &&
        'text' in content &&
        typeof content.text === 'string'
      ) {
        return content.text;
      }
    }
  }

  return null;
};

const openAiRequest = async (path: string, body: Record<string, unknown>) => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch(`${OPENAI_API_URL}${path}`, {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const errorMessage =
      typeof payload.error === 'object' &&
      payload.error !== null &&
      'message' in payload.error &&
      typeof payload.error.message === 'string'
        ? payload.error.message
        : `OpenAI request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload;
};

const generateCandidates = async (
  scheduledFor: string,
  attempt: number,
  excludedKeywords: string[]
) => {
  const exclusionList = excludedKeywords.slice(-300).join(', ');
  const prompt = `Create exactly ${CANDIDATES_PER_ATTEMPT} distinct English learning items for Korean learners aged 14 or older.

Release date: ${scheduledFor}
Generation attempt: ${attempt} of ${MAX_GENERATION_ATTEMPTS}

Requirements:
- Prefer natural, frequently useful spoken English over quotations or textbook-only wording.
- Balance Daily, Business, Travel, Developer, and OPIc categories.
- Use CEFR A2, B1, B2, or C1 only.
- Every keyword/core expression must be unique within this response.
- The example must demonstrate the keyword naturally and must not be a trivial rewrite of another item.
- Korean meanings must be concise and idiomatic.
- Avoid profanity, sexual content, hate, violence, medical/legal/financial advice, and content unsuitable for users aged 14+.
- Do not use any excluded keyword/core expression listed below.

Excluded normalized keywords:
${exclusionList || '(none)'}`;

  const response = await openAiRequest('/responses', {
    model: GENERATION_MODEL,
    store: false,
    reasoning: { effort: 'low' },
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'weekly_english_content',
        strict: true,
        schema: contentSchema
      }
    },
    input: [
      {
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text: 'You are an expert curriculum editor. Follow the schema exactly and prioritize natural, reusable spoken English.'
          }
        ]
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt }]
      }
    ]
  });
  const responseText = getResponseText(response);

  if (!responseText) {
    throw new Error('OpenAI response did not include structured output text');
  }

  const parsed = JSON.parse(responseText) as { items?: GeneratedCandidate[] };

  if (!Array.isArray(parsed.items) || parsed.items.length !== CANDIDATES_PER_ATTEMPT) {
    throw new Error(
      `OpenAI returned ${parsed.items?.length ?? 0} candidates instead of ${CANDIDATES_PER_ATTEMPT}`
    );
  }

  return parsed.items;
};

const createEmbeddings = async (inputs: string[]) => {
  if (inputs.length === 0) {
    return [];
  }

  const payload = await openAiRequest('/embeddings', {
    model: EMBEDDING_MODEL,
    input: inputs,
    encoding_format: 'float',
    dimensions: EMBEDDING_DIMENSIONS
  });
  const data = Array.isArray(payload.data) ? payload.data : [];
  const embeddings = data
    .filter(
      (item): item is { index: number; embedding: number[] } =>
        typeof item === 'object' &&
        item !== null &&
        'index' in item &&
        typeof item.index === 'number' &&
        'embedding' in item &&
        Array.isArray(item.embedding)
    )
    .sort((left, right) => left.index - right.index)
    .map((item) => item.embedding.map(Number));

  if (
    embeddings.length !== inputs.length ||
    embeddings.some((embedding) => embedding.length !== EMBEDDING_DIMENSIONS)
  ) {
    throw new Error('OpenAI returned an unexpected embedding shape');
  }

  return embeddings;
};

const isValidCandidate = (candidate: GeneratedCandidate) =>
  typeof candidate.sentence === 'string' &&
  typeof candidate.meaning === 'string' &&
  typeof candidate.keyword === 'string' &&
  typeof candidate.example === 'string' &&
  candidate.sentence.trim().length >= 3 &&
  candidate.meaning.trim().length >= 2 &&
  candidate.keyword.trim().length >= 1 &&
  candidate.example.trim().length >= 3 &&
  LEVELS.includes(candidate.level) &&
  CATEGORIES.includes(candidate.category) &&
  Array.isArray(candidate.usage_situations) &&
  candidate.usage_situations.length === 2 &&
  Array.isArray(candidate.extra_examples) &&
  candidate.extra_examples.length === 2 &&
  Array.isArray(candidate.quiz?.distractors) &&
  candidate.quiz.distractors.length === 3;

const loadAndBackfillExistingContents = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase
    .from('contents')
    .select('id, sentence, normalized_sentence, keyword, normalized_keyword, example, embedding')
    .neq('status', 'rejected');

  if (error) {
    throw error;
  }

  const contents = (data ?? []) as ExistingContent[];
  const missingEmbeddingContents = contents.filter((content) => !parseEmbedding(content.embedding));

  if (missingEmbeddingContents.length > 0) {
    const embeddings = await createEmbeddings(
      missingEmbeddingContents.map((content) => content.example?.trim() || content.sentence)
    );

    await Promise.all(
      missingEmbeddingContents.map(async (content, index) => {
        const embedding = embeddings[index];
        const { error: updateError } = await supabase
          .from('contents')
          .update({ embedding, embedding_model: EMBEDDING_MODEL })
          .eq('id', content.id);

        if (updateError) {
          throw updateError;
        }

        content.embedding = embedding;
      })
    );
  }

  return contents;
};

const findDatabaseSimilarities = async (
  supabase: SupabaseClient,
  embeddings: number[][]
) =>
  Promise.all(
    embeddings.map(async (embedding) => {
      const { data, error } = await supabase.rpc('match_content_example_embedding', {
        query_embedding: embedding,
        match_count: 1
      });

      if (error) {
        throw error;
      }

      const match = Array.isArray(data) ? data[0] : null;
      return match
        ? {
            id: Number(match.id),
            similarity: Number(match.similarity)
          }
        : null;
    })
  );

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders
    });
  }

  const configuredCronSecret = Deno.env.get('WEEKLY_CONTENT_CRON_SECRET');
  const providedCronSecret = request.headers.get('x-cron-secret') ?? '';

  if (
    !configuredCronSecret ||
    !providedCronSecret ||
    !constantTimeEqual(configuredCronSecret, providedCronSecret)
  ) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Supabase service configuration is missing' }), {
      status: 500,
      headers: jsonHeaders
    });
  }

  const requestBody = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const scheduledFor = isIsoDate(requestBody.scheduledFor)
    ? requestBody.scheduledFor
    : getKoreanDate();
  const runKey = `weekly:${scheduledFor}`;
  const releaseKey = `weekly:${scheduledFor}`;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  let runId: string | null = null;

  try {
    const { data: existingRun, error: existingRunError } = await supabase
      .from('content_generation_runs')
      .select('id, status, accepted_count, rejected_count, updated_at, metadata')
      .eq('run_key', runKey)
      .maybeSingle();

    if (existingRunError) {
      throw existingRunError;
    }

    if (existingRun?.status === 'completed') {
      return new Response(
        JSON.stringify({
          runId: existingRun.id,
          status: existingRun.status,
          acceptedCount: existingRun.accepted_count,
          rejectedCount: existingRun.rejected_count,
          idempotent: true
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    if (existingRun) {
      const { data: existingRelease, error: existingReleaseError } = await supabase
        .from('content_releases')
        .select('id, status')
        .eq('release_key', releaseKey)
        .maybeSingle();

      if (existingReleaseError) {
        throw existingReleaseError;
      }

      if (existingRelease) {
        const { count: existingContentCount, error: existingContentError } = await supabase
          .from('contents')
          .select('id', { count: 'exact', head: true })
          .eq('release_id', existingRelease.id)
          .neq('status', 'rejected');

        if (existingContentError) {
          throw existingContentError;
        }

        if (existingContentCount === FINAL_CONTENT_COUNT) {
          const recoveredMetadata = {
            ...(typeof existingRun.metadata === 'object' && existingRun.metadata !== null
              ? existingRun.metadata
              : {}),
            recoveredRelease: true,
            releaseId: existingRelease.id
          };
          const { error: recoveryError } = await supabase
            .from('content_generation_runs')
            .update({
              status: 'completed',
              accepted_count: FINAL_CONTENT_COUNT,
              error_message: null,
              metadata: recoveredMetadata,
              completed_at: new Date().toISOString()
            })
            .eq('id', existingRun.id);

          if (recoveryError) {
            throw recoveryError;
          }

          return new Response(
            JSON.stringify({
              runId: existingRun.id,
              releaseId: existingRelease.id,
              status: existingRelease.status === 'published' ? 'published' : 'reviewing',
              acceptedCount: FINAL_CONTENT_COUNT,
              recovered: true
            }),
            { status: 200, headers: jsonHeaders }
          );
        }

        if ((existingContentCount ?? 0) > 0) {
          throw new Error(
            `Release ${existingRelease.id} contains ${existingContentCount} of ${FINAL_CONTENT_COUNT} contents and requires manual review`
          );
        }
      }
    }

    if (existingRun?.status === 'running') {
      const updatedAt = new Date(existingRun.updated_at).getTime();
      const isStale = Date.now() - updatedAt > 60 * 60 * 1000;

      if (!isStale) {
        return new Response(JSON.stringify({ error: 'This weekly generation is already running' }), {
          status: 409,
          headers: jsonHeaders
        });
      }
    }

    if (existingRun) {
      runId = existingRun.id;
      const { error } = await supabase
        .from('content_generation_runs')
        .update({
          status: 'running',
          accepted_count: 0,
          rejected_count: 0,
          provider: 'openai',
          model: GENERATION_MODEL,
          error_message: null,
          metadata: {},
          started_at: new Date().toISOString(),
          completed_at: null
        })
        .eq('id', runId);

      if (error) {
        throw error;
      }
    } else {
      const { data: newRun, error } = await supabase
        .from('content_generation_runs')
        .insert({
          run_key: runKey,
          scheduled_for: scheduledFor,
          requested_count: CANDIDATES_PER_ATTEMPT,
          provider: 'openai',
          model: GENERATION_MODEL,
          status: 'running',
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      runId = newRun.id;
    }

    const existingContents = await loadAndBackfillExistingContents(supabase);
    const existingKeywords = new Set(
      existingContents
        .map((content) => content.normalized_keyword || normalizeKeyword(content.keyword ?? ''))
        .filter(Boolean)
    );
    const existingSentences = new Set(
      existingContents.map((content) => content.normalized_sentence || normalizeSentence(content.sentence))
    );
    const promptExclusions = new Set(existingKeywords);
    const accepted: CandidateWithEmbedding[] = [];
    const rejectionCounts: RejectionCounts = {
      invalid: 0,
      keyword: 0,
      sentence: 0,
      database_similarity: 0,
      batch_similarity: 0
    };
    let generatedCount = 0;
    let attempts = 0;

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      const candidates = await generateCandidates(
        scheduledFor,
        attempt,
        Array.from(promptExclusions)
      );
      generatedCount += candidates.length;
      candidates.forEach((candidate) => promptExclusions.add(normalizeKeyword(candidate.keyword)));

      const structurallyValidCandidates = candidates.filter((candidate) => {
        if (!isValidCandidate(candidate)) {
          rejectionCounts.invalid += 1;
          return false;
        }
        return true;
      });
      const embeddings = await createEmbeddings(
        structurallyValidCandidates.map((candidate) => candidate.example)
      );
      const databaseMatches = await findDatabaseSimilarities(supabase, embeddings);

      for (let index = 0; index < structurallyValidCandidates.length; index += 1) {
        if (accepted.length >= FINAL_CONTENT_COUNT) {
          break;
        }

        const candidate = structurallyValidCandidates[index];
        const normalizedKeyword = normalizeKeyword(candidate.keyword);
        const normalizedSentence = normalizeSentence(candidate.sentence);

        if (
          existingKeywords.has(normalizedKeyword) ||
          accepted.some((item) => item.normalized_keyword === normalizedKeyword)
        ) {
          rejectionCounts.keyword += 1;
          continue;
        }

        if (
          existingSentences.has(normalizedSentence) ||
          accepted.some((item) => item.normalized_sentence === normalizedSentence)
        ) {
          rejectionCounts.sentence += 1;
          continue;
        }

        const databaseMatch = databaseMatches[index];

        if (databaseMatch && databaseMatch.similarity >= SIMILARITY_THRESHOLD) {
          rejectionCounts.database_similarity += 1;
          continue;
        }

        const closestBatchSimilarity = accepted.reduce(
          (closest, item) => Math.max(closest, cosineSimilarity(embeddings[index], item.embedding)),
          -1
        );

        if (closestBatchSimilarity >= SIMILARITY_THRESHOLD) {
          rejectionCounts.batch_similarity += 1;
          continue;
        }

        accepted.push({
          ...candidate,
          normalized_keyword: normalizedKeyword,
          normalized_sentence: normalizedSentence,
          embedding: embeddings[index],
          similar_content_id: databaseMatch?.id ?? null,
          similarity_score:
            databaseMatch || closestBatchSimilarity >= 0
              ? Math.max(databaseMatch?.similarity ?? -1, closestBatchSimilarity)
              : null
        });
      }

      if (accepted.length >= FINAL_CONTENT_COUNT) {
        break;
      }
    }

    const rejectedCount = generatedCount - accepted.length;

    if (accepted.length < FINAL_CONTENT_COUNT) {
      const metadata = {
        attempts,
        generatedCount,
        targetCount: FINAL_CONTENT_COUNT,
        similarityThreshold: SIMILARITY_THRESHOLD,
        rejectionCounts
      };
      const { error } = await supabase
        .from('content_generation_runs')
        .update({
          status: 'failed',
          accepted_count: accepted.length,
          rejected_count: rejectedCount,
          error_message: `Only ${accepted.length} unique contents passed filtering`,
          metadata,
          completed_at: new Date().toISOString()
        })
        .eq('id', runId);

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ runId, status: 'failed', ...metadata }), {
        status: 422,
        headers: jsonHeaders
      });
    }

    const { data: release, error: releaseError } = await supabase
      .from('content_releases')
      .upsert(
        {
          release_key: releaseKey,
          title: `${scheduledFor} 주간 학습 콘텐츠`,
          kind: 'weekly',
          status: 'draft',
          planned_count: FINAL_CONTENT_COUNT,
          generation_run_id: runId,
          published_at: null
        },
        { onConflict: 'release_key' }
      )
      .select('id')
      .single();

    if (releaseError) {
      throw releaseError;
    }

    const { error: contentInsertError } = await supabase.from('contents').insert(
      accepted.map((candidate, index) => ({
        content_index: null,
        sentence: normalizeWhitespace(candidate.sentence),
        normalized_sentence: candidate.normalized_sentence,
        meaning: normalizeWhitespace(candidate.meaning),
        keyword: normalizeWhitespace(candidate.keyword),
        keyword_meaning: normalizeWhitespace(candidate.keyword_meaning),
        example: normalizeWhitespace(candidate.example),
        example_meaning: normalizeWhitespace(candidate.example_meaning),
        level: candidate.level,
        category: candidate.category,
        usage_situations: candidate.usage_situations,
        extra_examples: candidate.extra_examples,
        tone_tip: candidate.tone_tip,
        ai_explanation: candidate.ai_explanation,
        quiz: candidate.quiz,
        intent_en: candidate.intent_en,
        embedding: candidate.embedding,
        embedding_model: EMBEDDING_MODEL,
        source: 'llm',
        quality_score: 85,
        status: 'reviewing',
        generation_run_id: runId,
        release_id: release.id,
        release_position: index + 1,
        similar_content_id: candidate.similar_content_id,
        similarity_score: candidate.similarity_score
      }))
    );

    if (contentInsertError) {
      await supabase.from('content_releases').update({ status: 'failed' }).eq('id', release.id);
      throw contentInsertError;
    }

    const metadata = {
      attempts,
      generatedCount,
      targetCount: FINAL_CONTENT_COUNT,
      similarityThreshold: SIMILARITY_THRESHOLD,
      embeddingModel: EMBEDDING_MODEL,
      releaseId: release.id,
      rejectionCounts
    };
    const { error: completionError } = await supabase
      .from('content_generation_runs')
      .update({
        status: 'completed',
        accepted_count: FINAL_CONTENT_COUNT,
        rejected_count: rejectedCount,
        metadata,
        completed_at: new Date().toISOString()
      })
      .eq('id', runId);

    if (completionError) {
      throw completionError;
    }

    return new Response(
      JSON.stringify({
        runId,
        releaseId: release.id,
        status: 'reviewing',
        acceptedCount: FINAL_CONTENT_COUNT,
        rejectedCount,
        attempts
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown weekly generation error';

    if (runId) {
      await supabase
        .from('content_generation_runs')
        .update({
          status: 'failed',
          error_message: errorMessage.slice(0, 1000),
          completed_at: new Date().toISOString()
        })
        .eq('id', runId);
    }

    console.error('Weekly content generation failed', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage, runId }), {
      status: 500,
      headers: jsonHeaders
    });
  }
});
