-- EchoDev schema. RLS is enabled on every table in the same migration that creates it.

create table public.teacher_allowlist (
  email text primary key check (email = lower(email))
);
alter table public.teacher_allowlist enable row level security;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pseudonym_id uuid not null unique default gen_random_uuid(),
  role text not null default 'estudante' check (role in ('professor', 'estudante')),
  depth_pref text not null default 'curta' check (depth_pref in ('curta', 'exemplo', 'passos')),
  lang_pref text not null default 'pt' check (lang_pref in ('pt', 'en', 'es')),
  mode text not null default 'padrao' check (mode in ('padrao', 'calmo')),
  literal_mode boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null
    check (purpose in ('termos_uso', 'tratamento_dados', 'doacao_lexico', 'doacao_sinais')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index consents_one_active_per_purpose
  on public.consents (user_id, purpose) where revoked_at is null;
alter table public.consents enable row level security;

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  status text not null default 'criada' check (status in ('criada', 'ao_vivo', 'encerrada')),
  pack_ids text[] not null default array['programacao-geral'],
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index lessons_teacher_idx on public.lessons (teacher_id, created_at desc);
alter table public.lessons enable row level security;

create table public.lesson_members (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  pseudonym_id uuid not null references public.profiles (pseudonym_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (lesson_id, pseudonym_id)
);
create index lesson_members_pseudonym_idx on public.lesson_members (pseudonym_id);
alter table public.lesson_members enable row level security;

create table public.utterances (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  seq integer not null check (seq > 0),
  text text not null check (char_length(text) <= 5000),
  terms jsonb not null default '[]'::jsonb check (jsonb_typeof(terms) = 'array'),
  wpm integer not null default 0 check (wpm >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (lesson_id, seq)
);
create index utterances_expires_idx on public.utterances (expires_at);
alter table public.utterances enable row level security;

create table public.term_events (
  id bigint generated always as identity primary key,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  pseudonym_id uuid not null references public.profiles (pseudonym_id) on delete cascade,
  term_id text not null check (char_length(term_id) between 1 and 64),
  kind text not null check (kind in ('tap', 'doubt', 'helped', 'not_helped')),
  depth text check (depth is null or depth in ('curta', 'exemplo', 'passos')),
  created_at timestamptz not null default now()
);
create index term_events_lesson_idx on public.term_events (lesson_id, term_id);
create index term_events_pseudonym_idx on public.term_events (pseudonym_id);
alter table public.term_events enable row level security;

create table public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  kind text not null check (kind in ('resumo', 'quiz')),
  content jsonb not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'descartado')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, kind)
);
alter table public.lesson_materials enable row level security;

create table public.lesson_reports (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.lesson_reports enable row level security;

-- Pairs only, no personal data (no author column on purpose).
create table public.term_corrections (
  id bigint generated always as identity primary key,
  term_id text not null check (char_length(term_id) between 1 and 64),
  heard text not null check (char_length(heard) between 1 and 80),
  correct text not null check (char_length(correct) between 1 and 80),
  created_at timestamptz not null default now()
);
alter table public.term_corrections enable row level security;
