-- User-level settings: the native language (language of explanations, translations and
-- feedback) applies to every target language, so it moves off learner_profiles.

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  native_lang text not null check (native_lang in ('cs', 'en', 'es', 'de', 'it', 'fr', 'ru')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;
create policy "own settings" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- keep what each learner chose most recently
insert into public.user_settings (user_id, native_lang)
select distinct on (user_id) user_id, native_lang
from public.learner_profiles
order by user_id, updated_at desc;

alter table public.learner_profiles drop column native_lang;
