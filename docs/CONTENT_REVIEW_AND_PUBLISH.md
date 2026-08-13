# 주간 콘텐츠 검수·승인·게시 매뉴얼

이 문서는 매주 LLM이 생성한 영어 학습 콘텐츠를 Supabase에서 검수하고 앱에 게시하는 운영 절차입니다.

## 전체 흐름

1. 월요일 오전 3시 10분(KST)에 생성 작업이 실행됩니다.
2. 생성 성공 또는 실패 결과가 Discord로 전송됩니다.
3. 성공한 경우 정확히 8개가 `reviewing` 상태로 저장됩니다.
4. 관리자가 8개를 검수하고 `approved`로 변경합니다.
5. 게시 함수를 실행합니다.
6. 게시 완료 결과가 Discord로 전송됩니다.

`reviewing`이나 `approved` 상태의 콘텐츠는 앱에 노출되지 않습니다. 게시 함수가 성공해 `published`가 된 콘텐츠만 앱에서 조회됩니다.

## 1. 검수할 릴리스 찾기

Supabase Dashboard에서 **Table Editor → `content_releases`**로 이동합니다.

- `kind`: `weekly`
- `status`: `draft`
- `created_at`: 가장 최근

해당 행의 `id`를 복사합니다. 이 값이 아래 예시의 `RELEASE_UUID`입니다.

SQL Editor에서는 다음 쿼리로 찾을 수도 있습니다.

```sql
select
  id,
  release_key,
  title,
  status,
  planned_count,
  created_at
from public.content_releases
where kind = 'weekly'
order by created_at desc
limit 10;
```

## 2. 생성된 8개 확인하기

**Table Editor → `contents`**에서 다음 필터를 설정합니다.

```text
release_id = RELEASE_UUID
```

SQL Editor에서는 아래 쿼리를 사용할 수 있습니다.

```sql
select
  id,
  release_position,
  status,
  sentence,
  meaning,
  keyword,
  keyword_meaning,
  example,
  example_meaning,
  level,
  category,
  usage_situations,
  extra_examples,
  tone_tip,
  ai_explanation,
  quiz,
  similarity_score
from public.contents
where release_id = 'RELEASE_UUID'
order by release_position;
```

각 항목에서 다음 사항을 확인합니다.

- `sentence`: 실제 회화에서 자연스럽고 재사용하기 좋은 문장인가?
- `meaning`: 영어 문장의 의미를 자연스러운 한국어로 전달하는가?
- `keyword`, `keyword_meaning`: 핵심 표현과 뜻이 문장에 맞는가?
- `example`, `example_meaning`: 핵심 표현이 자연스럽게 사용됐는가?
- `usage_situations`: 두 상황이 구체적이고 서로 의미가 있는가?
- `extra_examples`: 두 예문과 번역이 자연스러운가?
- `tone_tip`: 존댓말, 친근함, 격식 등 어조 설명이 정확한가?
- `ai_explanation`: 학습자에게 도움이 되고 사실과 다른 설명이 없는가?
- `quiz`: 정답이 하나뿐이고 오답 3개가 명백한 오답인가?
- `level`, `category`: 난이도와 분류가 적절한가?
- 14세 이상 이용자에게 부적절한 욕설·성적·혐오·과도한 폭력 표현이 없는가?
- 같은 릴리스 안에서 뜻이나 활용 상황이 지나치게 겹치지 않는가?

## 3. 수정하기

오탈자나 번역 문제는 Table Editor에서 해당 필드를 직접 수정할 수 있습니다.

`sentence`를 수정할 때는 `normalized_sentence`도 함께 변경해야 합니다. 영문을 소문자로 바꾸고, 문장 끝의 마침표·물음표·느낌표를 제거하고, 연속된 공백은 하나로 만듭니다.

예시:

```text
sentence: Could you give me a hand with this box?
normalized_sentence: could you give me a hand with this box
```

`keyword`의 정규화 값은 DB가 자동으로 관리합니다.

## 4. 승인하기

문제가 없는 행은 다음처럼 변경합니다.

- `status`: `reviewing` → `approved`
- `reviewed_at`: 현재 시각
- `rejection_reason`: 비워두기

8개를 모두 검수한 뒤 한 번에 승인하려면 SQL Editor에서 실행합니다.

```sql
update public.contents
set
  status = 'approved'::public.content_status,
  reviewed_at = now(),
  rejection_reason = null
where release_id = 'RELEASE_UUID'
  and status = 'reviewing'::public.content_status;
```

## 5. 반려하기

사용할 수 없는 콘텐츠는 다음처럼 변경합니다.

```sql
update public.contents
set
  status = 'rejected'::public.content_status,
  reviewed_at = now(),
  rejection_reason = '반려 사유를 작성하세요'
where id = CONTENT_ID;
```

현재 게시 함수는 릴리스에 승인된 항목이 정확히 8개 있어야 실행됩니다. 하나라도 반려하면 즉시 게시할 수 없습니다. 반려 항목을 직접 수정한 뒤 승인하거나, 보충 생성 기능으로 대체 항목을 만들어야 합니다.

## 6. 게시 전 확인

```sql
select
  status,
  count(*) as count
from public.contents
where release_id = 'RELEASE_UUID'
group by status
order by status;
```

`approved`가 정확히 `8`인지 확인합니다.

## 7. 게시하기

```sql
select public.publish_content_release('RELEASE_UUID');
```

결과가 `8`이면 성공입니다. 함수가 다음 작업을 한 트랜잭션에서 처리합니다.

- 콘텐츠 8개에 연속된 `content_index` 배정
- 콘텐츠 상태를 `published`로 변경
- `published_at` 기록
- 릴리스 상태를 `published`로 변경
- Discord 게시 완료 알림 요청

게시 결과 확인:

```sql
select
  r.id,
  r.status as release_status,
  r.published_at,
  count(c.id) as published_contents,
  min(c.content_index) as first_content_index,
  max(c.content_index) as last_content_index
from public.content_releases r
join public.contents c on c.release_id = r.id
where r.id = 'RELEASE_UUID'
group by r.id, r.status, r.published_at;
```

게시 후에는 되돌리기보다 잘못된 콘텐츠를 새 마이그레이션이나 관리 작업으로 수정하는 편이 안전합니다.

## 생성 실패 시 확인

Discord 실패 알림을 받으면 SQL Editor에서 최근 실행을 확인합니다.

```sql
select
  run_key,
  scheduled_for,
  status,
  accepted_count,
  rejected_count,
  error_message,
  metadata,
  created_at,
  completed_at
from public.content_generation_runs
order by created_at desc
limit 10;
```

주요 원인은 OpenAI 키·사용 한도, 네트워크 오류, 스키마 불일치, 중복 제거 후 8개 미만입니다. 실패 상태에서는 콘텐츠가 앱에 게시되지 않습니다.

## Discord 알림 설정

1. Discord 서버에서 **서버 설정 → 연동 → 웹후크 → 새 웹후크**를 선택합니다.
2. 알림을 받을 채널을 선택하고 Webhook URL을 복사합니다.
3. Webhook URL은 비밀번호처럼 취급하고 앱 코드, `.env`, Git, 채팅에 남기지 않습니다.
4. Supabase Dashboard에서 **Database Vault**로 이동합니다. 메뉴 검색에서 `Vault`를 검색해도 됩니다.
5. 다음 이름으로 Secret을 만듭니다.

```text
Name: daily_english_discord_content_webhook_url
Secret: 복사한 Discord Webhook URL
```

> 중요: **Edge Function Secrets** 페이지에 넣으면 안 됩니다. 이 Discord 알림은 PostgreSQL 트리거가 직접 보내기 때문에 반드시 **Database Vault**에 저장해야 합니다. `OPENAI_API_KEY`가 있는 Edge Function Secrets와는 별개의 저장소입니다.

6. SQL Editor에서 테스트 알림을 보냅니다.

```sql
select public.enqueue_discord_content_notification(
  '🔔 콘텐츠 알림 연결 테스트',
  'Discord Webhook과 Supabase Vault 연결이 정상입니다.',
  5793266,
  jsonb_build_array(
    jsonb_build_object('name', '환경', 'value', 'production', 'inline', true)
  )
);
```

반환값은 비동기 HTTP 요청 ID입니다. Discord 채널에 메시지가 도착하면 설정이 완료된 것입니다.

- 숫자가 반환됨: Discord HTTP 요청이 대기열에 정상 등록됨
- `null`이 반환됨: Database Vault에서 `daily_english_discord_content_webhook_url`을 찾지 못했거나 알림 요청을 등록하지 못함

Vault 등록 여부는 URL 값을 노출하지 않고 다음 쿼리로 확인할 수 있습니다.

```sql
select count(*) as configured
from vault.secrets
where name = 'daily_english_discord_content_webhook_url';
```

결과가 `1`이어야 합니다.

알림 종류:

- `✅ 주간 콘텐츠 생성 성공`
- `❌ 주간 콘텐츠 생성 실패`
- `🚀 콘텐츠 게시 완료`

Discord 알림 전송은 비동기 방식입니다. Discord 장애가 콘텐츠 생성이나 게시를 실패시키지는 않습니다.
