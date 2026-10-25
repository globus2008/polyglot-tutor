-- Polyglot Tutor – initial schema.
-- Everything a learner owns is protected by RLS keyed on auth.uid().
-- API keys are never readable through the Data API; only the server (secret key) touches them.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Households (family sharing one API key)
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete cascade,
  -- default daily voice minutes per member when the household key is used
  daily_minutes_limit integer not null default 30 check (daily_minutes_limit between 0 and 600),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  -- a user belongs to at most one household
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  -- overrides households.daily_minutes_limit when set
  daily_minutes_limit integer check (daily_minutes_limit between 0 and 600),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- security definer so policies on household tables don't recurse into themselves
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create policy "members read their household" on public.households
  for select to authenticated using (public.is_household_member(id));
create policy "owners update their household" on public.households
  for update to authenticated using (public.is_household_owner(id));

create policy "members read fellow members" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));
create policy "owners manage members" on public.household_members
  for update to authenticated using (public.is_household_owner(household_id));
create policy "owners remove members, members leave" on public.household_members
  for delete to authenticated
  using (public.is_household_owner(household_id) or user_id = (select auth.uid()));
-- creating households and accepting invites goes through the server (phase 5)

-- ---------------------------------------------------------------------------
-- API keys (BYOK) – AES-256-GCM ciphertext, server access only
-- ---------------------------------------------------------------------------

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openai' check (provider in ('openai')),
  user_id uuid references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  ciphertext text not null,
  last4 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(user_id, household_id) = 1),
  -- plain (not partial) so upsert's ON CONFLICT can target them; NULLs never collide
  unique (provider, user_id),
  unique (provider, household_id)
);
create trigger api_keys_updated_at before update on public.api_keys
  for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;
-- no policies on purpose
revoke all on public.api_keys from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Learner profile – one per user and target language
-- ---------------------------------------------------------------------------

create table public.learner_profiles (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  language text not null check (language in ('es', 'en')),
  cefr_level text not null check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  interests text[] not null default '{}',
  goals text not null default '' check (char_length(goals) <= 1000),
  native_lang text not null default 'cs',
  -- conversation style, applied to the Realtime session
  -- lead: tutor proposes topics and keeps the talk going; follow: learner steers
  tutor_initiative text not null default 'lead' check (tutor_initiative in ('lead', 'balanced', 'follow')),
  -- auto: voice activity detection ends the turn; push_to_talk: learner ends it with a button
  turn_mode text not null default 'auto' check (turn_mode in ('auto', 'push_to_talk')),
  -- silence before the tutor takes the turn (auto mode)
  end_of_turn_pause_ms integer not null default 1500 check (end_of_turn_pause_ms between 500 and 4000),
  -- silence after which the tutor helps out with a hint or easier question; 0 = never
  idle_prompt_s integer not null default 10 check (idle_prompt_s = 0 or idle_prompt_s between 5 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, language)
);

create trigger learner_profiles_updated_at before update on public.learner_profiles
  for each row execute function public.set_updated_at();

alter table public.learner_profiles enable row level security;
create policy "own profiles" on public.learner_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Topic catalogue (seeded, read-only for users)
-- ---------------------------------------------------------------------------

create table public.topics (
  id text primary key,
  language text not null check (language in ('es', 'en')),
  cefr_level text not null check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  title text not null,
  title_cs text not null,
  scenario text not null,
  grammar_focus text[] not null default '{}',
  vocab_focus text[] not null default '{}',
  tags text[] not null default '{}'
);

create index topics_language_level on public.topics (language, cefr_level);

alter table public.topics enable row level security;
create policy "topics readable" on public.topics for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Lessons (one voice conversation)
-- ---------------------------------------------------------------------------

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  language text not null check (language in ('es', 'en')),
  topic_id text references public.topics (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'finished', 'analyzed', 'failed')),
  plan jsonb not null default '{}',
  transcript jsonb not null default '[]',
  summary text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_s integer
);

create index lessons_user_started on public.lessons (user_id, language, started_at desc);

alter table public.lessons enable row level security;
create policy "own lessons" on public.lessons
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Mistakes (aggregated per user, language and pattern)
-- ---------------------------------------------------------------------------

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  language text not null check (language in ('es', 'en')),
  lesson_id uuid references public.lessons (id) on delete set null,
  category text not null,
  original text not null,
  corrected text not null,
  explanation_cs text not null default '',
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  mastered_at timestamptz
);

create index mistakes_user_open on public.mistakes (user_id, language, last_seen_at desc) where mastered_at is null;

alter table public.mistakes enable row level security;
create policy "own mistakes" on public.mistakes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Vocabulary with FSRS scheduling state
-- ---------------------------------------------------------------------------

create table public.vocab_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  language text not null check (language in ('es', 'en')),
  term text not null,
  translation text not null,
  example text not null default '',
  lesson_id uuid references public.lessons (id) on delete set null,
  due timestamptz not null default now(),
  -- remaining ts-fsrs Card fields (stability, difficulty, reps, lapses, state, …)
  fsrs jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index vocab_items_unique_term on public.vocab_items (user_id, language, lower(term));
create index vocab_items_due on public.vocab_items (user_id, language, due);

alter table public.vocab_items enable row level security;
create policy "own vocab" on public.vocab_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Daily usage – written only by the server, used for cost limits
-- ---------------------------------------------------------------------------

create table public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  -- set when the household key paid for the audio
  household_id uuid references public.households (id) on delete set null,
  audio_seconds integer not null default 0,
  primary key (user_id, day)
);

alter table public.usage_daily enable row level security;
create policy "own usage or household owner" on public.usage_daily
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_household_owner(household_id));

-- ---------------------------------------------------------------------------
-- Grants for the Data API (RLS above still applies)
-- ---------------------------------------------------------------------------

grant select on public.topics to authenticated;
grant select, insert, update, delete on public.learner_profiles, public.lessons, public.mistakes, public.vocab_items to authenticated;
grant select, update, delete on public.households, public.household_members to authenticated;
grant select on public.usage_daily to authenticated;
revoke all on public.households, public.household_members, public.learner_profiles, public.topics,
  public.lessons, public.mistakes, public.vocab_items, public.usage_daily from anon;
