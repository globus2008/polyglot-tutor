-- A0: complete beginners (before A1), also suited to children
alter table public.learner_profiles drop constraint learner_profiles_cefr_level_check;
alter table public.learner_profiles add constraint learner_profiles_cefr_level_check
  check (cefr_level in ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

-- the tutor switches to a playful, child-friendly style
alter table public.learner_profiles add column for_child boolean not null default false;
