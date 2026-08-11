begin;

create table public.content_generation_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  scheduled_for date not null,
  requested_count smallint not null default 20 check (requested_count > 0),
  accepted_count smallint not null default 0 check (accepted_count >= 0),
  rejected_count smallint not null default 0 check (rejected_count >= 0),
  provider text,
  model text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_releases (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique,
  title text not null,
  kind text not null check (kind in ('starter', 'weekly', 'manual')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived', 'failed')),
  planned_count smallint not null default 20 check (planned_count > 0),
  generation_run_id uuid references public.content_generation_runs(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

alter table public.contents
  add column intent_en text,
  add column embedding_model text,
  add column quality_score smallint not null default 50,
  add column source text not null default 'curated',
  add column generation_run_id uuid references public.content_generation_runs(id) on delete set null,
  add column release_id uuid references public.content_releases(id) on delete set null,
  add column release_position smallint;

alter table public.contents
  add constraint contents_quality_score_check check (quality_score between 0 and 100),
  add constraint contents_source_check check (source in ('curated', 'llm', 'imported')),
  add constraint contents_release_position_check check (release_position is null or release_position > 0),
  add constraint contents_published_index_check
    check (status <> 'published'::public.content_status or content_index is not null);

alter table public.profiles
  add column timezone text not null default 'Asia/Seoul';

create unique index contents_normalized_sentence_unique_idx
  on public.contents (lower(btrim(normalized_sentence)));

create index contents_published_index_idx
  on public.contents (content_index)
  where status = 'published'::public.content_status;

create unique index contents_release_position_idx
  on public.contents (release_id, release_position)
  where release_id is not null and release_position is not null;

create table public.review_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_id bigint not null references public.contents(id) on delete cascade,
  selected_content_id bigint references public.contents(id) on delete set null,
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

create index review_attempts_user_answered_idx
  on public.review_attempts (user_id, answered_at desc);

create table public.wrong_notes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_id bigint not null references public.contents(id) on delete cascade,
  wrong_count integer not null default 1 check (wrong_count > 0),
  correct_streak integer not null default 0 check (correct_streak >= 0),
  status text not null default 'active' check (status in ('active', 'mastered')),
  last_wrong_at timestamptz not null default now(),
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, content_id)
);

create index wrong_notes_due_idx
  on public.wrong_notes (user_id, next_review_at)
  where status = 'active';

create trigger content_generation_runs_set_updated_at
before update on public.content_generation_runs
for each row execute function public.set_updated_at();

create trigger content_releases_set_updated_at
before update on public.content_releases
for each row execute function public.set_updated_at();

create trigger wrong_notes_set_updated_at
before update on public.wrong_notes
for each row execute function public.set_updated_at();

create or replace function public.daily_english_create_default_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.favorite_categories (user_id, name, sort_order)
  values (new.id, '기본', -100)
  on conflict (user_id, name) do nothing;

  return new;
end;
$$;

create trigger daily_english_default_favorite_category
after insert on public.profiles
for each row execute function public.daily_english_create_default_category();

insert into public.favorite_categories (user_id, name, sort_order)
select p.id, '기본', -100
from public.profiles p
on conflict (user_id, name) do nothing;

create or replace function public.daily_english_apply_review_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_correct then
    update public.wrong_notes
       set correct_streak = correct_streak + 1,
           status = case when correct_streak + 1 >= 2 then 'mastered' else 'active' end,
           next_review_at = case
             when correct_streak + 1 >= 2 then null
             else new.answered_at + interval '3 days'
           end
     where user_id = new.user_id
       and content_id = new.content_id;
  else
    insert into public.wrong_notes (
      user_id,
      content_id,
      wrong_count,
      correct_streak,
      status,
      last_wrong_at,
      next_review_at
    )
    values (
      new.user_id,
      new.content_id,
      1,
      0,
      'active',
      new.answered_at,
      new.answered_at + interval '1 day'
    )
    on conflict (user_id, content_id) do update
    set wrong_count = public.wrong_notes.wrong_count + 1,
        correct_streak = 0,
        status = 'active',
        last_wrong_at = excluded.last_wrong_at,
        next_review_at = excluded.next_review_at;
  end if;

  return new;
end;
$$;

create trigger review_attempts_apply_result
after insert on public.review_attempts
for each row execute function public.daily_english_apply_review_attempt();

create or replace function public.get_current_content_id()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_learning_date date;
  v_current_index integer;
  v_content_id bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  insert into public.profiles (id, email, nickname, profile_image)
  select
    u.id,
    u.email,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'name', ''),
      nullif(u.raw_user_meta_data ->> 'nickname', '')
    ),
    nullif(u.raw_user_meta_data ->> 'avatar_url', '')
  from auth.users u
  where u.id = v_user_id
  on conflict (id) do nothing;

  insert into public.user_progress (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

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

  select l.content_id
    into v_content_id
    from public.learning_logs l
   where l.user_id = v_user_id
     and l.completed_date = v_learning_date
   limit 1;

  if found then
    return v_content_id;
  end if;

  select p.current_content_index
    into v_current_index
    from public.user_progress p
   where p.user_id = v_user_id;

  select c.id
    into v_content_id
    from public.contents c
   where c.status = 'published'::public.content_status
     and c.content_index >= v_current_index
   order by c.content_index
   limit 1;

  return v_content_id;
end;
$$;

create or replace function public.complete_current_content(p_content_id bigint default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_learning_date date;
  v_current_index integer;
  v_content_id bigint;
  v_content_index integer;
  v_existing_content_id bigint;
  v_log_id bigint;
  v_next_streak integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

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

  select l.content_id
    into v_existing_content_id
    from public.learning_logs l
   where l.user_id = v_user_id
     and l.completed_date = v_learning_date
   limit 1;

  if found then
    return p_content_id is null or p_content_id = v_existing_content_id;
  end if;

  select p.current_content_index
    into v_current_index
    from public.user_progress p
   where p.user_id = v_user_id
   for update;

  select c.id, c.content_index
    into v_content_id, v_content_index
    from public.contents c
   where c.status = 'published'::public.content_status
     and c.content_index >= v_current_index
   order by c.content_index
   limit 1;

  if v_content_id is null or (p_content_id is not null and p_content_id <> v_content_id) then
    return false;
  end if;

  insert into public.learning_logs (
    user_id,
    content_id,
    content_index,
    completed_date
  )
  values (
    v_user_id,
    v_content_id,
    v_content_index,
    v_learning_date
  )
  on conflict (user_id, completed_date) do nothing
  returning id into v_log_id;

  if v_log_id is null then
    return true;
  end if;

  select case
    when p.last_completed_date = v_learning_date then p.streak
    when p.last_completed_date = v_learning_date - 1 then p.streak + 1
    else 1
  end
    into v_next_streak
    from public.user_progress p
   where p.user_id = v_user_id;

  update public.user_progress
     set current_content_index = v_content_index + 1,
         streak = v_next_streak,
         longest_streak = greatest(longest_streak, v_next_streak),
         total_completed = total_completed + 1,
         last_completed_date = v_learning_date
   where user_id = v_user_id;

  return true;
end;
$$;

alter table public.content_generation_runs enable row level security;
alter table public.content_releases enable row level security;
alter table public.review_attempts enable row level security;
alter table public.wrong_notes enable row level security;

create policy "Published contents are publicly readable"
on public.contents for select
to anon
using (status = 'published'::public.content_status);

create policy "Published content releases are readable"
on public.content_releases for select
to anon, authenticated
using (status = 'published');

create policy "Users can insert own favorite category items"
on public.favorite_category_items for insert
to authenticated
with check (
  exists (
    select 1 from public.favorites f
    where f.id = favorite_id and f.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.favorite_categories c
    where c.id = category_id and c.user_id = (select auth.uid())
  )
);

create policy "Users can delete own favorite category items"
on public.favorite_category_items for delete
to authenticated
using (
  exists (
    select 1 from public.favorites f
    where f.id = favorite_id and f.user_id = (select auth.uid())
  )
);

create policy "Users can read own review attempts"
on public.review_attempts for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own review attempts"
on public.review_attempts for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can read own wrong notes"
on public.wrong_notes for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can delete own wrong notes"
on public.wrong_notes for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.contents to anon, authenticated;
grant select on public.content_releases to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nickname, profile_image, timezone) on public.profiles to authenticated;
grant select on public.user_progress to authenticated;
grant select on public.learning_logs to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.favorite_categories to authenticated;
grant select, insert, delete on public.favorite_category_items to authenticated;
grant select, insert on public.review_attempts to authenticated;
grant select, delete on public.wrong_notes to authenticated;

grant usage, select on sequence public.favorites_id_seq to authenticated;
grant usage, select on sequence public.favorite_categories_id_seq to authenticated;
grant usage, select on sequence public.favorite_category_items_id_seq to authenticated;
grant usage, select on sequence public.review_attempts_id_seq to authenticated;

grant all on public.content_generation_runs to service_role;
grant all on public.content_releases to service_role;
grant all on public.contents to service_role;
grant all on public.review_attempts to service_role;
grant all on public.wrong_notes to service_role;
grant all on sequence public.contents_id_seq to service_role;
grant all on sequence public.review_attempts_id_seq to service_role;

revoke all on function public.daily_english_create_default_category() from public;
revoke all on function public.daily_english_apply_review_attempt() from public;
revoke all on function public.get_current_content_id() from public;
revoke all on function public.complete_current_content(bigint) from public;

grant execute on function public.get_current_content_id() to authenticated;
grant execute on function public.complete_current_content(bigint) to authenticated;

commit;
