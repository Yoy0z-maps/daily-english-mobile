# Weekly content generation

매주 월요일 오전 3시 10분(Asia/Seoul)에 후보를 생성하고 중복을 제거한 뒤, 정확히 8개를 `reviewing` 상태로 저장합니다. 자동으로 사용자에게 게시하지 않으며 관리자가 검수한 뒤 게시 함수를 실행해야 합니다.

반복 운영을 위한 전체 검수·승인·게시 및 Discord 알림 설정 방법은 [`docs/CONTENT_REVIEW_AND_PUBLISH.md`](../../../docs/CONTENT_REVIEW_AND_PUBLISH.md)를 참고합니다.

## 1. Edge Function 비밀값

실제 값은 앱의 `.env`나 Git에 저장하지 말고 Supabase Edge Function Secrets에 직접 등록합니다.

```sh
supabase secrets set \
  OPENAI_API_KEY=... \
  OPENAI_GENERATION_MODEL=gpt-5.6-sol \
  OPENAI_EMBEDDING_MODEL=text-embedding-3-small \
  CONTENT_SIMILARITY_THRESHOLD=0.93 \
  WEEKLY_CONTENT_CRON_SECRET=충분히-긴-임의-문자열
```

`WEEKLY_CONTENT_CRON_SECRET`은 아래 Vault에 넣는 값과 반드시 같아야 합니다.

## 2. Cron용 Vault 비밀값

Supabase SQL Editor에서 실제 프로젝트 URL과 위에서 만든 Cron 비밀값을 등록합니다.

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'daily_english_project_url'
);

select vault.create_secret(
  'YOUR_WEEKLY_CONTENT_CRON_SECRET',
  'daily_english_weekly_content_cron_secret'
);
```

이미 같은 이름이 있다면 Dashboard의 Vault에서 기존 값을 갱신합니다. SQL 실행 기록에 비밀값을 남기고 싶지 않다면 Dashboard의 Vault UI를 사용합니다.

## 3. 배포

```sh
supabase db push
supabase functions deploy generate-weekly-content
```

Cron은 마이그레이션에서 `10 18 * * 0`(UTC)로 등록되며 한국 시간으로 월요일 오전 3시 10분입니다.

## 4. 수동 실행

배포 후 첫 실행은 예약 시간을 기다리지 않고 로컬 셸에서 확인할 수 있습니다.

```sh
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-weekly-content' \
  -H 'Content-Type: application/json' \
  -H 'x-cron-secret: YOUR_WEEKLY_CONTENT_CRON_SECRET' \
  -d '{"scheduledFor":"2026-08-17","source":"manual"}'
```

같은 날짜로 다시 호출해도 완료된 생성 작업을 재사용합니다. 후보는 한 번에 20개씩 최대 3회 생성하며, 키워드가 같거나 예문 임베딩 코사인 유사도가 기준값 이상이면 제외합니다. 최종 통과 항목이 8개 미만이면 릴리스를 만들지 않고 해당 실행을 `failed`로 기록합니다.

## 5. 검수 및 게시

Supabase Table Editor에서 해당 릴리스의 `contents`를 검수합니다. 게시할 8개 모두 `status = 'approved'`로 바꾼 뒤 SQL Editor에서 실행합니다.

```sql
select public.publish_content_release('CONTENT_RELEASE_UUID');
```

함수는 승인된 콘텐츠가 정확히 8개인지 다시 검사하고, 연속된 `content_index`를 배정한 뒤 한 트랜잭션에서 게시합니다. 하나라도 반려한다면 나머지도 즉시 게시하지 말고 해당 릴리스를 보충 생성하거나 다음 릴리스로 넘겨야 합니다.
