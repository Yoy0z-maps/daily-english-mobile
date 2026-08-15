begin;

create or replace function public.get_learning_dashboard()
returns table (
  current_content_id bigint,
  current_content_index integer,
  streak integer,
  longest_streak integer,
  total_completed integer,
  last_completed_date date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_learning_date date;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

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

  return query
  select
    c.id,
    c.content_index,
    case
      when p.last_completed_date is null then 0
      when p.last_completed_date >= v_learning_date - 1 then p.streak
      else 0
    end,
    p.longest_streak,
    p.total_completed,
    p.last_completed_date
  from public.user_progress p
  left join public.contents c
    on c.id = public.get_current_content_id()
  where p.user_id = v_user_id;
end;
$$;

create or replace function public.get_review_queue(p_limit integer default 5)
returns table (
  content_id bigint,
  content_index integer,
  is_wrong_note boolean,
  correct_streak integer
)
language sql
volatile
security definer
set search_path = ''
as $$
  with learned as (
    select distinct l.content_id
      from public.learning_logs l
     where l.user_id = auth.uid()
  ),
  candidates as (
    select
      c.id as content_id,
      c.content_index,
      (w.status = 'active') as is_wrong_note,
      coalesce(w.correct_streak, 0) as correct_streak,
      w.next_review_at,
      random() as random_order
    from learned l
    join public.contents c
      on c.id = l.content_id
     and c.status = 'published'::public.content_status
    left join public.wrong_notes w
      on w.user_id = auth.uid()
     and w.content_id = l.content_id
     and w.status = 'active'
  )
  select
    candidates.content_id,
    candidates.content_index,
    candidates.is_wrong_note,
    candidates.correct_streak
  from candidates
  order by
    candidates.is_wrong_note desc,
    candidates.next_review_at asc nulls last,
    candidates.random_order
  limit greatest(1, least(coalesce(p_limit, 5), 5));
$$;

create or replace function public.record_review_answer(
  p_content_id bigint,
  p_selected_content_id bigint,
  p_is_correct boolean
)
returns table (
  wrong_note_status text,
  correct_streak integer,
  mastered boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.learning_logs l
     where l.user_id = v_user_id
       and l.content_id = p_content_id
  ) then
    raise exception 'Only completed content can be reviewed' using errcode = '22023';
  end if;

  if p_selected_content_id is not null and not exists (
    select 1
      from public.contents c
     where c.id = p_selected_content_id
       and c.status = 'published'::public.content_status
  ) then
    raise exception 'Selected content is not published' using errcode = '22023';
  end if;

  insert into public.review_attempts (
    user_id,
    content_id,
    selected_content_id,
    is_correct
  )
  values (
    v_user_id,
    p_content_id,
    p_selected_content_id,
    p_is_correct
  );

  return query
  select
    coalesce(w.status, 'none'),
    coalesce(w.correct_streak, 0),
    coalesce(w.status = 'mastered', false)
  from (select 1) seed
  left join public.wrong_notes w
    on w.user_id = v_user_id
   and w.content_id = p_content_id;
end;
$$;

drop policy if exists "Users can insert own review attempts"
  on public.review_attempts;
drop policy if exists "Users can delete own wrong notes"
  on public.wrong_notes;

revoke insert on public.review_attempts from authenticated;
revoke delete on public.wrong_notes from authenticated;

revoke all on function public.get_learning_dashboard() from public;
revoke all on function public.get_review_queue(integer) from public;
revoke all on function public.record_review_answer(bigint, bigint, boolean) from public;

grant execute on function public.get_learning_dashboard() to authenticated;
grant execute on function public.get_review_queue(integer) to authenticated;
grant execute on function public.record_review_answer(bigint, bigint, boolean) to authenticated;

commit;

comment on function public.get_learning_dashboard() is
  'Returns server-authoritative learning totals and an effective streak that expires after a missed day.';
comment on function public.get_review_queue(integer) is
  'Returns up to five completed contents, prioritizing active wrong notes.';
comment on function public.record_review_answer(bigint, bigint, boolean) is
  'Records an answer for completed content and returns the two-correct-answer mastery state.';
