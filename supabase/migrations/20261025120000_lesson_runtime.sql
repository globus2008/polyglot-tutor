-- Phase 2: voice lessons.

-- Corrections the tutor logged live (log_correction tool); phase 3 analysis folds them into mistakes.
alter table public.lessons
  add column corrections jsonb not null default '[]',
  add column model text;

-- Atomic per-day usage counter. Called by the server with the secret key only.
create or replace function public.add_usage(p_user_id uuid, p_day date, p_seconds integer, p_household_id uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.usage_daily (user_id, day, household_id, audio_seconds)
  values (p_user_id, p_day, p_household_id, greatest(p_seconds, 0))
  on conflict (user_id, day) do update
    set audio_seconds = public.usage_daily.audio_seconds + greatest(excluded.audio_seconds, 0),
        household_id = coalesce(excluded.household_id, public.usage_daily.household_id);
$$;

revoke execute on function public.add_usage(uuid, date, integer, uuid) from public, anon, authenticated;
grant execute on function public.add_usage(uuid, date, integer, uuid) to service_role;
