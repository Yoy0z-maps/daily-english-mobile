begin;

create or replace function public.enqueue_discord_content_notification(
  p_title text,
  p_description text,
  p_color integer,
  p_fields jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook_url text;
  v_request_id bigint;
  v_fields jsonb;
begin
  select decrypted_secret
    into v_webhook_url
    from vault.decrypted_secrets
   where name = 'daily_english_discord_content_webhook_url'
   limit 1;

  if v_webhook_url is null or btrim(v_webhook_url) = '' then
    return null;
  end if;

  v_fields := case
    when jsonb_typeof(p_fields) = 'array' then p_fields
    else '[]'::jsonb
  end;

  select net.http_post(
    url := v_webhook_url || case
      when strpos(v_webhook_url, '?') > 0 then '&wait=true'
      else '?wait=true'
    end,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'username', '오늘의 문장 콘텐츠 알림',
      'allowed_mentions', jsonb_build_object('parse', jsonb_build_array()),
      'embeds', jsonb_build_array(
        jsonb_build_object(
          'title', left(coalesce(p_title, '콘텐츠 알림'), 256),
          'description', left(coalesce(p_description, ''), 4096),
          'color', greatest(0, least(coalesce(p_color, 5793266), 16777215)),
          'fields', v_fields,
          'timestamp', clock_timestamp()
        )
      )
    ),
    timeout_milliseconds := 10000
  )
  into v_request_id;

  return v_request_id;
exception
  when others then
    raise warning 'Discord content notification could not be queued: %', sqlerrm;
    return null;
end;
$$;

create or replace function public.notify_discord_on_content_generation_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_success boolean := new.status = 'completed';
  v_fields jsonb;
begin
  if old.status is not distinct from new.status
     or new.status not in ('completed', 'failed') then
    return new;
  end if;

  v_fields := jsonb_build_array(
    jsonb_build_object(
      'name', '실행 키',
      'value', left(coalesce(new.run_key, '-'), 1024),
      'inline', false
    ),
    jsonb_build_object(
      'name', '예정일',
      'value', coalesce(new.scheduled_for::text, '-'),
      'inline', true
    ),
    jsonb_build_object(
      'name', '선별',
      'value', new.accepted_count::text || '개',
      'inline', true
    ),
    jsonb_build_object(
      'name', '제외',
      'value', new.rejected_count::text || '개',
      'inline', true
    ),
    jsonb_build_object(
      'name', '생성 시도',
      'value', coalesce(new.metadata ->> 'attempts', '-'),
      'inline', true
    )
  );

  if v_is_success and coalesce(new.metadata ->> 'releaseId', '') <> '' then
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object(
        'name', '릴리스 ID',
        'value', left(new.metadata ->> 'releaseId', 1024),
        'inline', false
      )
    );
  elsif not v_is_success then
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object(
        'name', '오류',
        'value', left(coalesce(new.error_message, '오류 메시지가 없습니다.'), 1024),
        'inline', false
      )
    );
  end if;

  perform public.enqueue_discord_content_notification(
    case
      when v_is_success then '✅ 주간 콘텐츠 생성 성공'
      else '❌ 주간 콘텐츠 생성 실패'
    end,
    case
      when v_is_success then '검수 대기 콘텐츠가 생성되었습니다.'
      else '주간 콘텐츠 생성 작업을 확인해 주세요.'
    end,
    case when v_is_success then 5763719 else 15548997 end,
    v_fields
  );

  return new;
end;
$$;

create or replace function public.notify_discord_on_content_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_published_count integer;
begin
  if old.status is not distinct from new.status or new.status <> 'published' then
    return new;
  end if;

  select count(*)::integer
    into v_published_count
    from public.contents c
   where c.release_id = new.id
     and c.status = 'published'::public.content_status;

  perform public.enqueue_discord_content_notification(
    '🚀 콘텐츠 게시 완료',
    '검수와 승인이 끝난 콘텐츠가 앱에 게시되었습니다.',
    5793266,
    jsonb_build_array(
      jsonb_build_object(
        'name', '릴리스',
        'value', left(coalesce(new.title, new.release_key), 1024),
        'inline', false
      ),
      jsonb_build_object(
        'name', '릴리스 ID',
        'value', new.id::text,
        'inline', false
      ),
      jsonb_build_object(
        'name', '게시 콘텐츠',
        'value', v_published_count::text || '개',
        'inline', true
      ),
      jsonb_build_object(
        'name', '게시 시각',
        'value', coalesce(new.published_at::text, now()::text),
        'inline', true
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists content_generation_runs_notify_discord
  on public.content_generation_runs;

create trigger content_generation_runs_notify_discord
after update of status on public.content_generation_runs
for each row
execute function public.notify_discord_on_content_generation_run();

drop trigger if exists content_releases_notify_discord
  on public.content_releases;

create trigger content_releases_notify_discord
after update of status on public.content_releases
for each row
execute function public.notify_discord_on_content_release();

revoke all on function public.enqueue_discord_content_notification(text, text, integer, jsonb)
  from public;
revoke all on function public.notify_discord_on_content_generation_run()
  from public;
revoke all on function public.notify_discord_on_content_release()
  from public;

grant execute on function public.enqueue_discord_content_notification(text, text, integer, jsonb)
  to service_role;

commit;

comment on function public.enqueue_discord_content_notification(text, text, integer, jsonb) is
  'Queues a Discord webhook notification using a URL stored in Supabase Vault.';
