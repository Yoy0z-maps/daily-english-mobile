begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select ok(
  to_regprocedure('public.import_guest_learning_state(jsonb)') is not null,
  'guest import RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.import_guest_learning_state(jsonb)', 'EXECUTE'),
  'signed-out clients cannot import guest data'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-222222222222',
  'authenticated',
  'authenticated',
  'guest-import@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

create temporary table guest_payload as
select jsonb_build_object(
  'completions', jsonb_build_array(
    jsonb_build_object('content_index', 0, 'completed_date', (now() at time zone 'Asia/Seoul')::date - 2),
    jsonb_build_object('content_index', 1, 'completed_date', (now() at time zone 'Asia/Seoul')::date - 1),
    -- 미래 날짜와 존재하지 않는 문장은 무시된다.
    jsonb_build_object('content_index', 2, 'completed_date', (now() at time zone 'Asia/Seoul')::date + 1),
    jsonb_build_object('content_index', 9999, 'completed_date', (now() at time zone 'Asia/Seoul')::date - 5)
  ),
  'categories', jsonb_build_array('기본', '여행'),
  'saved', jsonb_build_array(
    jsonb_build_object('content_index', 0, 'categories', jsonb_build_array('기본', '여행')),
    jsonb_build_object('content_index', 5, 'categories', jsonb_build_array('여행'))
  ),
  'wrong_notes', jsonb_build_array(
    jsonb_build_object(
      'content_index', 1,
      'wrong_count', 2,
      'correct_streak', 1,
      'status', 'active',
      'last_wrong_at', now(),
      'next_review_at', now() + interval '1 day'
    ),
    -- 학습하지 않은 문장의 오답은 옮기지 않는다.
    jsonb_build_object(
      'content_index', 7,
      'wrong_count', 1,
      'correct_streak', 0,
      'status', 'active',
      'last_wrong_at', now(),
      'next_review_at', now()
    )
  )
) as payload;

select lives_ok(
  $$ select public.import_guest_learning_state((select payload from guest_payload)) $$,
  'guest learning state imports'
);

select is(
  (select count(*)::integer from public.learning_logs where user_id = '22222222-2222-4222-8222-222222222222'),
  2,
  'only past completions of published content are imported'
);
select is(
  (select total_completed from public.get_learning_dashboard()),
  2,
  'total completed is recomputed'
);
select is(
  (select streak from public.get_learning_dashboard()),
  2,
  'consecutive completions ending yesterday keep the streak'
);
select is(
  (select current_content_index from public.get_learning_dashboard()),
  2,
  'today''s content continues after the last imported completion'
);
select is(
  (select count(*)::integer from public.favorites where user_id = '22222222-2222-4222-8222-222222222222'),
  2,
  'saved expressions are imported'
);
select is(
  (
    select count(*)::integer
      from public.favorite_category_items i
      join public.favorite_categories c on c.id = i.category_id
     where c.user_id = '22222222-2222-4222-8222-222222222222'
  ),
  3,
  'category memberships are imported by name'
);
select is(
  (select count(*)::integer from public.favorite_categories where user_id = '22222222-2222-4222-8222-222222222222' and name = '기본'),
  1,
  'the default category is not duplicated'
);
select is(
  (select count(*)::integer from public.wrong_notes where user_id = '22222222-2222-4222-8222-222222222222'),
  1,
  'only wrong notes for completed content are imported'
);

select lives_ok(
  $$ select public.import_guest_learning_state((select payload from guest_payload)) $$,
  'importing the same state again succeeds'
);
select is(
  (select total_completed from public.get_learning_dashboard()),
  2,
  'repeated imports do not duplicate progress'
);

select * from finish();

rollback;
