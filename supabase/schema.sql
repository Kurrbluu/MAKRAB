-- Run once in the Supabase SQL Editor. Safe to run again.
create table if not exists public.makrab_game_sessions (
  session_key text primary key,
  store_version bigint not null default 0,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.makrab_public_sessions (
  session_key text primary key references public.makrab_game_sessions(session_key) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default clock_timestamp(),
  constraint makrab_public_has_no_scores check (state::text !~ '"(gmPin|scoring|entries|history|totals|points|role|actor|lastCleared)"\s*:')
);
create table if not exists public.makrab_gm_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  session_key text not null references public.makrab_game_sessions(session_key) on delete cascade,
  actor text not null check (char_length(actor) between 1 and 40),
  pin_fingerprint text not null check (pin_fingerprint ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null
);
create table if not exists public.makrab_login_limits (
  bucket text primary key,
  attempts integer not null,
  window_started_at timestamptz not null
);

alter table public.makrab_game_sessions enable row level security;
alter table public.makrab_public_sessions enable row level security;
alter table public.makrab_gm_sessions enable row level security;
alter table public.makrab_login_limits enable row level security;
revoke all on public.makrab_game_sessions, public.makrab_gm_sessions, public.makrab_login_limits from anon, authenticated;
revoke all on public.makrab_public_sessions from anon, authenticated;
grant select on public.makrab_public_sessions to anon, authenticated;
grant all on public.makrab_game_sessions, public.makrab_public_sessions, public.makrab_gm_sessions, public.makrab_login_limits to service_role;
drop policy if exists makrab_public_read on public.makrab_public_sessions;
create policy makrab_public_read on public.makrab_public_sessions for select to anon, authenticated using (true);

create or replace function public.makrab_publish_session() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' or (old.document -> 'state') is distinct from (new.document -> 'state') then
    insert into public.makrab_public_sessions(session_key, state, updated_at)
    values(new.session_key, new.document -> 'state', clock_timestamp())
    on conflict(session_key) do update set state = excluded.state, updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;
drop trigger if exists makrab_publish_session on public.makrab_game_sessions;
create trigger makrab_publish_session after insert or update on public.makrab_game_sessions
for each row execute function public.makrab_publish_session();

create or replace function public.makrab_init_session(p_session_key text, p_document jsonb)
returns setof public.makrab_game_sessions
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.makrab_game_sessions(session_key, document) values(p_session_key, p_document)
  on conflict(session_key) do nothing;
  return query select * from public.makrab_game_sessions where session_key = p_session_key;
end;
$$;
create or replace function public.makrab_compare_session(p_session_key text, p_expected_version bigint, p_document jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  update public.makrab_game_sessions set document = p_document, store_version = store_version + 1, updated_at = clock_timestamp()
  where session_key = p_session_key and store_version = p_expected_version;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
create or replace function public.makrab_login_attempt(p_bucket text, p_now timestamptz)
returns integer language plpgsql security invoker set search_path = '' as $$
declare result integer;
begin
  insert into public.makrab_login_limits(bucket, attempts, window_started_at) values(p_bucket, 1, p_now)
  on conflict(bucket) do update set
    attempts = case when p_now - makrab_login_limits.window_started_at >= interval '60 seconds' then 1 else makrab_login_limits.attempts + 1 end,
    window_started_at = case when p_now - makrab_login_limits.window_started_at >= interval '60 seconds' then p_now else makrab_login_limits.window_started_at end
  returning attempts into result;
  delete from public.makrab_login_limits where window_started_at < p_now - interval '1 day';
  return result;
end;
$$;
revoke execute on function public.makrab_init_session(text,jsonb), public.makrab_compare_session(text,bigint,jsonb), public.makrab_login_attempt(text,timestamptz), public.makrab_publish_session() from public, anon, authenticated;
grant execute on function public.makrab_init_session(text,jsonb), public.makrab_compare_session(text,bigint,jsonb), public.makrab_login_attempt(text,timestamptz), public.makrab_publish_session() to service_role;

-- Publish only the projection-safe table; private scores/auth are never replicated to viewers.
do $$
begin
  if not exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'makrab_public_sessions') then
    alter publication supabase_realtime add table public.makrab_public_sessions;
  end if;
end;
$$;
