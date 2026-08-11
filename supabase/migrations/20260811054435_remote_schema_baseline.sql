-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM service_role;

CREATE EXTENSION vector WITH SCHEMA extensions;

CREATE TYPE public.content_status AS ENUM (
  'draft',
  'reviewing',
  'approved',
  'published',
  'rejected'
);

CREATE TYPE public.subscription_plan AS ENUM (
  'monthly',
  'yearly',
  'lifetime'
);

CREATE TYPE public.subscription_status AS ENUM (
  'trialing',
  'active',
  'expired',
  'canceled',
  'refunded'
);

CREATE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.profiles (
    id,
    email,
    nickname,
    profile_image
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'nickname'
    ),
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.user_progress (user_id)
  values (new.id);

  return new;
end;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now(); -- 수정될 row의 updated_at 값을 현재 시간으로 변경
  return new; -- 트리거 함수에서는 보통 `new`를 수정한 뒤 다시 반환해야 실제 update가 됨
end;
$function$;

CREATE TABLE public.contents (
  id                  bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  content_index       integer,
  sentence            text                     NOT NULL,
  normalized_sentence text                     NOT NULL,
  meaning             text                     NOT NULL,
  keyword             text,
  keyword_meaning     text,
  example             text,
  example_meaning     text,
  level               text,
  category            text,
  usage_situations    jsonb                    DEFAULT '[]'::jsonb NOT NULL,
  extra_examples      jsonb                    DEFAULT '[]'::jsonb NOT NULL,
  tone_tip            text,
  ai_explanation      text,
  quiz                jsonb,
  embedding           extensions.vector(1536),
  status              public.content_status    DEFAULT 'draft'::public.content_status NOT NULL,
  rejection_reason    text,
  reviewed_at         timestamp with time zone,
  published_at        timestamp with time zone,
  similar_content_id  bigint,
  similarity_score    double precision,
  created_at          timestamp with time zone DEFAULT now() NOT NULL,
  updated_at          timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.contents
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contents
  ADD CONSTRAINT contents_content_index_key UNIQUE (content_index);

ALTER TABLE public.contents
  ADD CONSTRAINT contents_pkey PRIMARY KEY (id);

ALTER TABLE public.contents
  ADD CONSTRAINT contents_similar_content_id_fkey FOREIGN KEY (similar_content_id) REFERENCES public.contents(id) ON DELETE SET NULL;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.contents TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.contents TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.contents TO service_role;

CREATE TRIGGER set_contents_updated_at
  BEFORE UPDATE ON public.contents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Authenticated users can read published contents" ON public.contents
  FOR SELECT
  TO authenticated
  USING ((status = 'published'::public.content_status));

CREATE TABLE public.favorite_categories (
  id         bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id    uuid                     NOT NULL,
  name       text                     NOT NULL,
  color      text,
  sort_order integer                  DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.favorite_categories
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.favorite_categories
  ADD CONSTRAINT favorite_categories_pkey PRIMARY KEY (id);

ALTER TABLE public.favorite_categories
  ADD CONSTRAINT favorite_categories_user_id_name_key UNIQUE (user_id, name);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.favorite_categories TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.favorite_categories TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.favorite_categories TO service_role;

CREATE TRIGGER set_favorite_categories_updated_at
  BEFORE UPDATE ON public.favorite_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users can delete own favorite categories" ON public.favorite_categories
  FOR DELETE
  TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own favorite categories" ON public.favorite_categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own favorite categories" ON public.favorite_categories
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update own favorite categories" ON public.favorite_categories
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE TABLE public.favorite_category_items (
  id          bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  favorite_id bigint                   NOT NULL,
  category_id bigint                   NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.favorite_category_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.favorite_category_items
  ADD CONSTRAINT favorite_category_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.favorite_categories(id) ON DELETE CASCADE;

ALTER TABLE public.favorite_category_items
  ADD CONSTRAINT favorite_category_items_favorite_id_category_id_key UNIQUE (favorite_id, category_id);

ALTER TABLE public.favorite_category_items
  ADD CONSTRAINT favorite_category_items_pkey PRIMARY KEY (id);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.favorite_category_items TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.favorite_category_items TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.favorite_category_items TO service_role;

CREATE TABLE public.favorites (
  id         bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id    uuid                     NOT NULL,
  content_id bigint                   NOT NULL,
  note       text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE POLICY "Users can read own favorite category items" ON public.favorite_category_items
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.favorites f
  WHERE ((f.id = favorite_category_items.favorite_id) AND (f.user_id = auth.uid())))));

ALTER TABLE public.favorites
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.contents(id) ON DELETE CASCADE;

ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);

ALTER TABLE public.favorite_category_items
  ADD CONSTRAINT favorite_category_items_favorite_id_fkey FOREIGN KEY (favorite_id) REFERENCES public.favorites(id) ON DELETE CASCADE;

ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_user_id_content_id_key UNIQUE (user_id, content_id);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.favorites TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.favorites TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.favorites TO service_role;

CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE
  TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own favorites" ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own favorites" ON public.favorites
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update own favorites" ON public.favorites
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE TABLE public.learning_logs (
  id             bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id        uuid                     NOT NULL,
  content_id     bigint                   NOT NULL,
  content_index  integer                  NOT NULL,
  completed_date date                     NOT NULL,
  completed_at   timestamp with time zone DEFAULT now() NOT NULL,
  created_at     timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.learning_logs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.learning_logs
  ADD CONSTRAINT learning_logs_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.contents(id) ON DELETE CASCADE;

ALTER TABLE public.learning_logs
  ADD CONSTRAINT learning_logs_pkey PRIMARY KEY (id);

ALTER TABLE public.learning_logs
  ADD CONSTRAINT learning_logs_user_id_completed_date_key UNIQUE (user_id, completed_date);

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.learning_logs TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.learning_logs TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.learning_logs TO service_role;

CREATE POLICY "Users can insert own learning logs" ON public.learning_logs
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own learning logs" ON public.learning_logs
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id));

CREATE TABLE public.profiles (
  id            uuid                     NOT NULL,
  email         text,
  nickname      text,
  profile_image text,
  is_premium    boolean                  DEFAULT false NOT NULL,
  premium_plan  text,
  premium_until timestamp with time zone,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.favorite_categories
  ADD CONSTRAINT favorite_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.learning_logs
  ADD CONSTRAINT learning_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.profiles TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.profiles TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.profiles TO service_role;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = id));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE TABLE public.subscriptions (
  id                        bigint                     GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id                   uuid                       NOT NULL,
  plan                      public.subscription_plan   NOT NULL,
  status                    public.subscription_status DEFAULT 'trialing'::public.subscription_status NOT NULL,
  provider                  text,
  provider_subscription_id  text,
  provider_transaction_id   text,
  trial_started_at          timestamp with time zone,
  trial_ends_at             timestamp with time zone,
  current_period_started_at timestamp with time zone,
  current_period_ends_at    timestamp with time zone,
  purchased_at              timestamp with time zone,
  canceled_at               timestamp with time zone,
  created_at                timestamp with time zone   DEFAULT now() NOT NULL,
  updated_at                timestamp with time zone   DEFAULT now() NOT NULL
);

ALTER TABLE public.subscriptions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.subscriptions TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.subscriptions TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.subscriptions TO service_role;

CREATE TABLE public.user_progress (
  user_id               uuid                     NOT NULL,
  current_content_index integer                  DEFAULT 0 NOT NULL,
  streak                integer                  DEFAULT 0 NOT NULL,
  longest_streak        integer                  DEFAULT 0 NOT NULL,
  total_completed       integer                  DEFAULT 0 NOT NULL,
  last_completed_date   date,
  created_at            timestamp with time zone DEFAULT now() NOT NULL,
  updated_at            timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.user_progress
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_progress
  ADD CONSTRAINT user_progress_pkey PRIMARY KEY (user_id);

ALTER TABLE public.user_progress
  ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.user_progress TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.user_progress TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.user_progress TO service_role;

CREATE TRIGGER set_user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users can insert own progress" ON public.user_progress
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own progress" ON public.user_progress
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update own progress" ON public.user_progress
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
