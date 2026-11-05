-- Spanish for Spanish-speaking students: live caption translation and translated materials.
-- Translations are made in the teacher's browser; they expire with the sentence (24 h).

alter table public.utterances
  add column if not exists text_es text check (text_es is null or char_length(text_es) <= 5000);

alter table public.lesson_materials drop constraint if exists lesson_materials_kind_check;
alter table public.lesson_materials
  add constraint lesson_materials_kind_check check (kind in ('resumo', 'quiz', 'resumo_es', 'quiz_es'));
