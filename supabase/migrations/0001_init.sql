-- ============================================================================
-- 받아쓰기·맞춤법 학습 앱 — 초기 스키마
--
-- 설계 원칙
-- 1. 부모 계정(auth.users) 하나 아래 자녀 프로필 여러 개.
-- 2. 자녀 실명은 저장하지 않는다. 별명만 받는다. (만 14세 미만 개인정보 최소화)
-- 3. 모든 테이블에 RLS를 걸어, 부모는 자기 가족 데이터만 볼 수 있게 한다.
-- 4. 맞춤법 문제은행은 전역 공용 읽기 전용.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 가족 (부모 계정)
-- ---------------------------------------------------------------------------
create table if not exists families (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- 회원가입 시 families 행을 자동 생성
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.families (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- 자녀 프로필
-- ---------------------------------------------------------------------------
create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  -- 4자리 PIN은 해시로만 저장. 평문 저장 금지.
  pin_hash text,
  avatar text not null default '🐣',
  created_at timestamptz not null default now()
);
create index if not exists children_family_idx on children (family_id);

-- ---------------------------------------------------------------------------
-- 받아쓰기 세트
-- ---------------------------------------------------------------------------
create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
create index if not exists sets_family_idx on sets (family_id, created_at desc);

create table if not exists set_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references sets (id) on delete cascade,
  sentence text not null check (char_length(sentence) between 1 and 200),
  order_index int not null default 0
);
create index if not exists set_items_set_idx on set_items (set_id, order_index);

-- ---------------------------------------------------------------------------
-- 맞춤법 문제은행 (전역 공용, 읽기 전용)
-- ---------------------------------------------------------------------------
create table if not exists spelling_bank (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('mcq', 'fill', 'find')),
  -- mcq/fill: 보기에서 고르기. find: 문장에서 틀린 부분 찾기.
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  answer text not null,
  explanation text,
  tag text not null,              -- 예: '되/돼', '왠/웬'
  grade_level text not null default '1-2',
  created_at timestamptz not null default now()
);
create index if not exists spelling_bank_kind_idx on spelling_bank (kind, grade_level);

-- ---------------------------------------------------------------------------
-- 풀이 기록 — 세션을 끝까지 마쳤을 때만 기록한다
-- ---------------------------------------------------------------------------
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  module text not null check (module in ('dictation', 'spelling')),
  mode text not null check (mode in ('practice', 'exam')),
  set_id uuid references sets (id) on delete set null,
  spelling_kind text check (spelling_kind in ('mcq', 'fill', 'find')),
  score int not null check (score between 0 and 100),
  correct_count int not null default 0,
  total_count int not null check (total_count > 0),
  created_at timestamptz not null default now()
);
create index if not exists attempts_child_idx on attempts (child_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 오답노트 — 받아쓰기·맞춤법 통합
-- ---------------------------------------------------------------------------
create table if not exists wrong_notes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  module text not null check (module in ('dictation', 'spelling')),
  -- 받아쓰기는 문장 원문, 맞춤법은 spelling_bank.id 문자열
  ref_id text not null,
  content text not null,
  error_types text[] not null default '{}',
  streak int not null default 0 check (streak between 0 and 2),
  -- 같은 날 두 번 맞혀도 별을 주지 않기 위해 마지막 정답 날짜를 기록
  last_correct_date date,
  wrong_count int not null default 1,
  updated_at timestamptz not null default now(),
  unique (child_id, module, ref_id)
);
create index if not exists wrong_notes_child_idx on wrong_notes (child_id, streak);

-- ---------------------------------------------------------------------------
-- 보상 — 시험 모드를 끝까지 마쳤을 때만 발급
-- ---------------------------------------------------------------------------
create table if not exists trophies (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  kind text not null check (kind in ('gold', 'silver')),
  emblem text not null default '🏅',
  label text,
  source_name text,
  score int not null,
  created_at timestamptz not null default now()
);
create index if not exists trophies_child_idx on trophies (child_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 사진 인식 사용량 — 비용 급증 방지
-- ---------------------------------------------------------------------------
create table if not exists ocr_usage (
  family_id uuid not null references families (id) on delete cascade,
  used_on date not null default current_date,
  count int not null default 0,
  primary key (family_id, used_on)
);

-- ============================================================================
-- RLS — 부모는 자기 가족 데이터만
-- ============================================================================

alter table families enable row level security;
alter table children enable row level security;
alter table sets enable row level security;
alter table set_items enable row level security;
alter table attempts enable row level security;
alter table wrong_notes enable row level security;
alter table trophies enable row level security;
alter table ocr_usage enable row level security;
alter table spelling_bank enable row level security;

-- 현재 로그인한 사용자가 이 자녀의 보호자인지 확인
create or replace function owns_child(target uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from children c
    where c.id = target and c.family_id = auth.uid()
  );
$$;

drop policy if exists families_self on families;
create policy families_self on families
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists children_own on children;
create policy children_own on children
  for all using (family_id = auth.uid()) with check (family_id = auth.uid());

drop policy if exists sets_own on sets;
create policy sets_own on sets
  for all using (family_id = auth.uid()) with check (family_id = auth.uid());

drop policy if exists set_items_own on set_items;
create policy set_items_own on set_items
  for all using (
    exists (select 1 from sets s where s.id = set_id and s.family_id = auth.uid())
  ) with check (
    exists (select 1 from sets s where s.id = set_id and s.family_id = auth.uid())
  );

drop policy if exists attempts_own on attempts;
create policy attempts_own on attempts
  for all using (owns_child(child_id)) with check (owns_child(child_id));

drop policy if exists wrong_notes_own on wrong_notes;
create policy wrong_notes_own on wrong_notes
  for all using (owns_child(child_id)) with check (owns_child(child_id));

drop policy if exists trophies_own on trophies;
create policy trophies_own on trophies
  for all using (owns_child(child_id)) with check (owns_child(child_id));

drop policy if exists ocr_usage_own on ocr_usage;
create policy ocr_usage_own on ocr_usage
  for all using (family_id = auth.uid()) with check (family_id = auth.uid());

-- 맞춤법 문제은행은 로그인한 사용자 누구나 읽기만 가능
drop policy if exists spelling_bank_read on spelling_bank;
create policy spelling_bank_read on spelling_bank
  for select using (auth.role() = 'authenticated');
