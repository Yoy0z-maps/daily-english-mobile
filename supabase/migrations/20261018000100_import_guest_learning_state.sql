begin;

-- 로그인 없이 기기에 쌓은 학습 기록을 로그인한 계정으로 병합한다.
-- 같은 날짜·같은 문장·같은 카테고리는 무시하므로 여러 번 호출해도 결과가 같다.
create or replace function public.import_guest_learning_state(p_state jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_learning_date date;
  v_last_date date;
  v_current_streak integer;
  v_longest_streak integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_state is null or pg_catalog.jsonb_typeof(p_state) <> 'object' then
    raise exception 'Invalid guest learning state' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  -- profiles, user_progress 행을 보장한다.
  perform public.get_current_content_id();

  select p.timezone
    into v_timezone
    from public.profiles p
   where p.id = v_user_id;

  if not exists (
    select 1
      from pg_catalog.pg_timezone_names
     where name = v_timezone
  ) then
    v_timezone := 'Asia/Seoul';
  end if;

  v_learning_date := (pg_catalog.now() at time zone v_timezone)::date;

  -- 학습 완료: 하루 1문장, 문장당 1회 규칙을 유지한다. 계정에 이미 있는 기록이 우선한다.
  insert into public.learning_logs (user_id, content_id, content_index, completed_date)
  select distinct on (x.completed_date)
    v_user_id,
    c.id,
    c.content_index,
    x.completed_date
  from pg_catalog.jsonb_to_recordset(coalesce(p_state -> 'completions', '[]'::jsonb))
    as x(content_index integer, completed_date date)
  join public.contents c
    on c.content_index = x.content_index
   and c.status = 'published'::public.content_status
  where x.completed_date is not null
    and x.completed_date <= v_learning_date
    and not exists (
      select 1
        from public.learning_logs l
       where l.user_id = v_user_id
         and l.content_id = c.id
    )
  order by x.completed_date, x.content_index
  on conflict (user_id, completed_date) do nothing;

  -- 병합된 완료 기록으로 진행도와 스트릭을 다시 계산한다.
  with days as (
    select distinct l.completed_date as day
      from public.learning_logs l
     where l.user_id = v_user_id
  ),
  islands as (
    select day, day - (row_number() over (order by day))::integer as grp
      from days
  ),
  runs as (
    select max(day) as end_date, count(*)::integer as len
      from islands
     group by grp
  )
  select
    (select max(end_date) from runs),
    coalesce((select len from runs order by end_date desc limit 1), 0),
    coalesce((select max(len) from runs), 0)
    into v_last_date, v_current_streak, v_longest_streak;

  update public.user_progress p
     set total_completed = (
           select count(*)::integer
             from public.learning_logs l
            where l.user_id = v_user_id
         ),
         last_completed_date = v_last_date,
         streak = v_current_streak,
         longest_streak = greatest(p.longest_streak, v_longest_streak),
         current_content_index = greatest(
           p.current_content_index,
           coalesce((
             select max(l.content_index) + 1
               from public.learning_logs l
              where l.user_id = v_user_id
           ), 0)
         )
   where p.user_id = v_user_id;

  -- 저장 카테고리: 카테고리 이름이 계정 내 식별자다.
  insert into public.favorite_categories (user_id, name, sort_order)
  select distinct
    v_user_id,
    names.name,
    case when names.name = '기본' then -100 else 0 end
  from (
    select pg_catalog.btrim(n.name) as name
      from pg_catalog.jsonb_array_elements_text(coalesce(p_state -> 'categories', '[]'::jsonb)) as n(name)
    union
    select pg_catalog.btrim(cat.name)
      from pg_catalog.jsonb_to_recordset(coalesce(p_state -> 'saved', '[]'::jsonb))
        as s(content_index integer, categories jsonb)
     cross join lateral pg_catalog.jsonb_array_elements_text(coalesce(s.categories, '[]'::jsonb)) as cat(name)
  ) names
  where names.name <> ''
  on conflict (user_id, name) do nothing;

  -- 저장 문장과 카테고리 연결
  insert into public.favorites (user_id, content_id)
  select distinct v_user_id, c.id
  from pg_catalog.jsonb_to_recordset(coalesce(p_state -> 'saved', '[]'::jsonb))
    as s(content_index integer, categories jsonb)
  join public.contents c
    on c.content_index = s.content_index
   and c.status = 'published'::public.content_status
  on conflict (user_id, content_id) do nothing;

  insert into public.favorite_category_items (favorite_id, category_id)
  select distinct f.id, fc.id
  from pg_catalog.jsonb_to_recordset(coalesce(p_state -> 'saved', '[]'::jsonb))
    as s(content_index integer, categories jsonb)
  cross join lateral pg_catalog.jsonb_array_elements_text(coalesce(s.categories, '[]'::jsonb)) as cat(name)
  join public.contents c
    on c.content_index = s.content_index
   and c.status = 'published'::public.content_status
  join public.favorites f
    on f.user_id = v_user_id
   and f.content_id = c.id
  join public.favorite_categories fc
    on fc.user_id = v_user_id
   and fc.name = pg_catalog.btrim(cat.name)
  on conflict (favorite_id, category_id) do nothing;

  -- 오답노트: 학습 완료한 문장만 옮기고, 계정에 이미 있는 오답 기록이 우선한다.
  insert into public.wrong_notes (
    user_id,
    content_id,
    wrong_count,
    correct_streak,
    status,
    last_wrong_at,
    next_review_at
  )
  select distinct on (c.id)
    v_user_id,
    c.id,
    greatest(coalesce(w.wrong_count, 1), 1),
    greatest(coalesce(w.correct_streak, 0), 0),
    case when w.status = 'mastered' then 'mastered' else 'active' end,
    coalesce(w.last_wrong_at, pg_catalog.now()),
    case when w.status = 'mastered' then null else w.next_review_at end
  from pg_catalog.jsonb_to_recordset(coalesce(p_state -> 'wrong_notes', '[]'::jsonb))
    as w(
      content_index integer,
      wrong_count integer,
      correct_streak integer,
      status text,
      last_wrong_at timestamptz,
      next_review_at timestamptz
    )
  join public.contents c
    on c.content_index = w.content_index
   and c.status = 'published'::public.content_status
  where exists (
    select 1
      from public.learning_logs l
     where l.user_id = v_user_id
       and l.content_id = c.id
  )
  order by c.id
  on conflict (user_id, content_id) do nothing;
end;
$$;

revoke all on function public.import_guest_learning_state(jsonb) from public;
revoke all on function public.import_guest_learning_state(jsonb) from anon;
grant execute on function public.import_guest_learning_state(jsonb) to authenticated;

commit;

comment on function public.import_guest_learning_state(jsonb) is
  'Merges learning history recorded on a device before sign-in into the signed-in account.';
