-- Language of stored translations and explanations; null = unknown (written before this).
-- Review re-translates items whose language differs from the learner's current native language.
alter table public.vocab_items add column translation_lang text;
alter table public.mistakes add column explanation_lang text;
