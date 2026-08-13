begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.contents
  add column normalized_keyword text generated always as (
    lower(regexp_replace(btrim(keyword), '\s+', ' ', 'g'))
  ) stored;

create unique index contents_normalized_keyword_unique_idx
  on public.contents (normalized_keyword)
  where normalized_keyword is not null
    and status <> 'rejected'::public.content_status;

create index contents_embedding_cosine_idx
  on public.contents
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null
    and status <> 'rejected'::public.content_status;

create or replace function public.match_content_example_embedding(
  query_embedding extensions.vector(1536),
  match_count integer default 1
)
returns table (
  id bigint,
  similarity double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.contents c
  where c.embedding is not null
    and c.status <> 'rejected'::public.content_status
  order by c.embedding operator(extensions.<=>) query_embedding
  limit greatest(1, least(match_count, 20));
$$;

create or replace function public.publish_content_release(p_release_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_planned_count integer;
  v_approved_count integer;
  v_first_content_index integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-english-publish-content-release', 0)
  );

  select r.planned_count
    into v_planned_count
    from public.content_releases r
   where r.id = p_release_id
     and r.status = 'draft'
   for update;

  if v_planned_count is null then
    raise exception 'Draft content release % was not found', p_release_id;
  end if;

  select count(*)::integer
    into v_approved_count
    from public.contents c
   where c.release_id = p_release_id
     and c.status = 'approved'::public.content_status;

  if v_approved_count <> v_planned_count then
    raise exception 'Release % requires % approved contents, but % are approved',
      p_release_id,
      v_planned_count,
      v_approved_count;
  end if;

  select coalesce(max(c.content_index), -1) + 1
    into v_first_content_index
    from public.contents c
   where c.status = 'published'::public.content_status;

  update public.contents c
     set content_index = v_first_content_index + c.release_position - 1,
         status = 'published'::public.content_status,
         reviewed_at = coalesce(c.reviewed_at, now()),
         published_at = now()
   where c.release_id = p_release_id
     and c.status = 'approved'::public.content_status;

  update public.content_releases
     set status = 'published',
         published_at = now()
   where id = p_release_id;

  return v_approved_count;
end;
$$;

create or replace function public.invoke_weekly_content_generation()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_url text;
  v_cron_secret text;
  v_request_id bigint;
begin
  select decrypted_secret
    into v_project_url
    from vault.decrypted_secrets
   where name = 'daily_english_project_url'
   limit 1;

  select decrypted_secret
    into v_cron_secret
    from vault.decrypted_secrets
   where name = 'daily_english_weekly_content_cron_secret'
   limit 1;

  if v_project_url is null or v_cron_secret is null then
    raise exception 'Weekly content cron Vault secrets are not configured';
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/generate-weekly-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_cron_secret
    ),
    body := jsonb_build_object('source', 'supabase-cron'),
    timeout_milliseconds := 120000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.match_content_example_embedding(extensions.vector, integer) from public;
revoke all on function public.publish_content_release(uuid) from public;
revoke all on function public.invoke_weekly_content_generation() from public;

grant execute on function public.match_content_example_embedding(extensions.vector, integer) to service_role;
grant execute on function public.publish_content_release(uuid) to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid
    into v_job_id
    from cron.job
   where jobname = 'daily-english-weekly-content'
   limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'daily-english-weekly-content',
    '10 18 * * 0',
    'select public.invoke_weekly_content_generation()'
  );
end;
$$;

commit;

comment on function public.invoke_weekly_content_generation() is
  'Runs at Sunday 18:10 UTC, which is Monday 03:10 in Asia/Seoul.';
