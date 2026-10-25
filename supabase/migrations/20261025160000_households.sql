-- Phase 5: households – invites, joining, shared key limits.

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- sha256 (hex) of the token in the invite link; the token itself is never stored
  token_hash text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

alter table public.household_invites enable row level security;
create policy "owners read invites" on public.household_invites
  for select to authenticated using (public.is_household_owner(household_id));
create policy "owners create invites" on public.household_invites
  for insert to authenticated
  with check (public.is_household_owner(household_id) and created_by = (select auth.uid()));
create policy "owners revoke invites" on public.household_invites
  for update to authenticated using (public.is_household_owner(household_id));
grant select, insert, update on public.household_invites to authenticated;

create policy "owners delete their household" on public.households
  for delete to authenticated using (public.is_household_owner(id));
grant delete on public.households to authenticated;

-- Creates a household with the caller as owner. A user belongs to at most one household.
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.household_members where user_id = v_user) then
    raise exception 'already in a household' using errcode = 'P0001';
  end if;
  insert into public.households (name, created_by) values (trim(p_name), v_user) returning id into v_id;
  insert into public.household_members (household_id, user_id, role) values (v_id, v_user, 'owner');
  return v_id;
end;
$$;

-- Household name for a valid invite token, so the join page can say what you are joining.
create or replace function public.household_for_invite(p_token text)
returns table (household_id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.name
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.revoked_at is null
    and i.expires_at > now();
$$;

-- Joins the household of a valid invite token as a member.
create or replace function public.join_household(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  select household_id into v_household from public.household_for_invite(p_token);
  if v_household is null then
    raise exception 'invalid invite' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.household_members where user_id = v_user) then
    raise exception 'already in a household' using errcode = 'P0001';
  end if;
  insert into public.household_members (household_id, user_id, role) values (v_household, v_user, 'member');
  return v_household;
end;
$$;

revoke execute on function public.create_household(text), public.household_for_invite(text), public.join_household(text)
  from public, anon;
grant execute on function public.create_household(text), public.household_for_invite(text), public.join_household(text)
  to authenticated;
