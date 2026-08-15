begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select ok(
  to_regprocedure('public.get_learning_dashboard()') is not null,
  'learning dashboard RPC exists'
);
select ok(
  to_regprocedure('public.get_review_queue(integer)') is not null,
  'review queue RPC exists'
);
select ok(
  to_regprocedure('public.record_review_answer(bigint,bigint,boolean)') is not null,
  'review answer RPC exists'
);
select ok(
  pg_get_functiondef(to_regprocedure('public.get_review_queue(integer)')) like '%is_wrong_note desc%',
  'active wrong notes are ordered first'
);
select ok(
  pg_get_functiondef(to_regprocedure('public.get_review_queue(integer)')) like '%least(coalesce(p_limit, 5), 5)%',
  'review queue is capped at five'
);
select ok(
  not has_table_privilege('authenticated', 'public.review_attempts', 'INSERT'),
  'clients cannot bypass the review answer RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.wrong_notes', 'DELETE'),
  'clients cannot manually delete wrong notes'
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
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'learning-policy@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (select total_completed from public.get_learning_dashboard()),
  0,
  'new users start with zero completed content'
);
select is(
  (select streak from public.get_learning_dashboard()),
  0,
  'new users start with a zero streak'
);
select ok(
  public.complete_current_content((select id from public.contents where content_index = 0)),
  'current content can be completed'
);
select is(
  (select total_completed from public.get_learning_dashboard()),
  1,
  'completion increments the server total'
);
select is(
  (select streak from public.get_learning_dashboard()),
  1,
  'completion starts the current streak'
);
select is(
  (select count(*)::integer from public.get_review_queue(5)),
  1,
  'only completed content enters the review queue'
);

select is(
  (
    select wrong_note_status
      from public.record_review_answer(
        (select id from public.contents where content_index = 0),
        (select id from public.contents where content_index = 1),
        false
      )
  ),
  'active',
  'a wrong answer creates an active wrong note'
);
select is(
  (
    select correct_streak
      from public.record_review_answer(
        (select id from public.contents where content_index = 0),
        (select id from public.contents where content_index = 0),
        true
      )
  ),
  1,
  'the first correct retry keeps the wrong note active'
);
select ok(
  (
    select mastered
      from public.record_review_answer(
        (select id from public.contents where content_index = 0),
        (select id from public.contents where content_index = 0),
        true
      )
  ),
  'the second consecutive correct retry masters the wrong note'
);
select is(
  (
    select status
      from public.wrong_notes
     where user_id = '11111111-1111-4111-8111-111111111111'
       and content_id = (select id from public.contents where content_index = 0)
  ),
  'mastered',
  'mastery is persisted in the database'
);

update public.user_progress
   set streak = 4,
       longest_streak = 4,
       last_completed_date = (now() at time zone 'Asia/Seoul')::date - 2
 where user_id = '11111111-1111-4111-8111-111111111111';

select is(
  (select streak from public.get_learning_dashboard()),
  0,
  'the effective streak resets after one fully missed day'
);
select is(
  (select longest_streak from public.get_learning_dashboard()),
  4,
  'the historical longest streak is preserved'
);

select * from finish();

rollback;
