-- Internationalisation: explanations follow the learner's native language instead of
-- always Czech, and interests / topic tags become language-neutral keys.

-- ---------------------------------------------------------------------------
-- Native language (language of explanations, translations and feedback)
-- ---------------------------------------------------------------------------

alter table public.learner_profiles
  add constraint learner_profiles_native_lang_check
  check (native_lang in ('cs', 'en', 'es', 'de', 'it', 'fr', 'ru'));

alter table public.mistakes rename column explanation_cs to explanation;

-- Analysis results: *_cs keys → neutral keys
update public.lessons
set analysis = (analysis - 'summary_cs' - 'strengths_cs' - 'next_focus_cs' - 'mistakes' - 'new_vocabulary')
  || jsonb_strip_nulls(jsonb_build_object(
    'feedback', analysis -> 'summary_cs',
    'strengths', analysis -> 'strengths_cs',
    'next_focus', analysis -> 'next_focus_cs'))
  || jsonb_build_object(
    'mistakes', coalesce((
      select jsonb_agg((m - 'explanation_cs') || jsonb_build_object('explanation', m -> 'explanation_cs'))
      from jsonb_array_elements(analysis -> 'mistakes') m), '[]'::jsonb),
    'new_vocabulary', coalesce((
      select jsonb_agg((v - 'translation_cs') || jsonb_build_object('translation', v -> 'translation_cs'))
      from jsonb_array_elements(analysis -> 'new_vocabulary') v), '[]'::jsonb))
where analysis ? 'summary_cs';

-- failure messages were stored as Czech text; the UI now translates a code
update public.lessons set analysis = '{"error": "failed"}'::jsonb where analysis ? 'error';

update public.lessons
set corrections = coalesce((
  select jsonb_agg((c - 'explanation_cs') || jsonb_build_object('explanation', c -> 'explanation_cs'))
  from jsonb_array_elements(corrections) c), '[]'::jsonb)
where jsonb_array_length(corrections) > 0;

-- ---------------------------------------------------------------------------
-- Interests and topic tags: Czech labels → keys
-- ---------------------------------------------------------------------------

create temporary table interest_keys (label text primary key, key text not null) on commit drop;
insert into interest_keys values
  ('cestování', 'travel'),
  ('jídlo a vaření', 'food'),
  ('sport', 'sport'),
  ('práce a kariéra', 'work'),
  ('technologie', 'technology'),
  ('filmy a seriály', 'films'),
  ('hudba', 'music'),
  ('knihy', 'books'),
  ('příroda', 'nature'),
  ('zdraví', 'health'),
  ('rodina a vztahy', 'family'),
  ('historie a kultura', 'culture'),
  ('věda', 'science'),
  ('politika a společnost', 'society'),
  ('byznys a finance', 'business'),
  ('hry', 'games'),
  ('běžný život', 'everyday');

update public.learner_profiles p
set interests = array(
  select coalesce(k.key, u.item)
  from unnest(p.interests) with ordinality as u (item, ord)
  left join interest_keys k on k.label = u.item
  order by u.ord)
where cardinality(p.interests) > 0;

update public.topics t
set tags = array(
  select coalesce(k.key, u.item)
  from unnest(t.tags) with ordinality as u (item, ord)
  left join interest_keys k on k.label = u.item
  order by u.ord);
