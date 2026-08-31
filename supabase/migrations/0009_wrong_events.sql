-- 오답 이력 — 틀린 사건을 한 줄씩 쌓습니다.
--
-- 지금까지는 「지금 상태」만 저장하고 「일어난 일」은 저장하지 않았습니다.
-- wrong_notes 는 문제마다 한 줄이고 그 줄이 계속 덮어써집니다. 그래서
--
--   · 나아짐을 못 보여 줍니다 — 아이가 열심히 할수록 막대는 길어지기만 합니다
--   · 최근 기록을 눌러도 그날 무엇을 틀렸는지 볼 수 없습니다
--   · 오류 유형이 합집합으로 쌓이기만 해서 고친 것도 통계에 남습니다
--
-- 셋 다 여기서 풀립니다.
--
-- **틀린 것만 쌓습니다.** 받아쓰기에서 오류 유형은 틀렸을 때만 생기고,
-- 분모(푼 문제 수)는 이미 attempts.total_count 에 있습니다.
-- 맞힌 것까지 저장할 까닭이 없습니다 — 아이 정보는 적을수록 좋습니다.
create table if not exists wrong_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,

  -- 어느 세션이었나. 오답노트 복습은 attempts 에 안 남으므로 null 입니다.
  -- attempts 를 타고 가면 builtin_set_id 가 있어 **단계별**로도 셀 수 있습니다.
  attempt_id uuid references attempts (id) on delete cascade,

  module text not null check (module in ('dictation', 'spelling')),
  mode text not null check (mode in ('practice', 'exam')),

  -- 정규 세션인가 오답노트 복습인가.
  -- 복습은 attempts 에 안 남아 분모가 없습니다. 섞으면 오답률이 부풀어요.
  source text not null default 'session' check (source in ('session', 'review')),

  -- wrong_notes.ref_id 와 같은 규칙 — 받아쓰기는 문장 원문, 맞춤법은 문항 id
  ref_id text not null,

  -- 그때의 문제를 그대로 박아 둡니다.
  -- 받아쓰기는 ref_id 가 문장 원문이라, 부모가 세트를 고치면 옛 사건이 미아가 됩니다.
  content text not null,

  -- 아이가 실제로 쓴 것. 「받침 8건」까지만 알고 어떻게 틀리는지 모르면 반쪽입니다.
  input text,

  error_types text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 리포트가 최근 몇 주를 읽습니다
create index if not exists wrong_events_child_idx on wrong_events (child_id, created_at desc);
-- 「이 문장을 몇 번 틀렸나」
create index if not exists wrong_events_ref_idx on wrong_events (child_id, ref_id);

alter table wrong_events enable row level security;

-- 새 정책 함수가 필요 없습니다. 기존 owns_child() 를 그대로 씁니다.
drop policy if exists wrong_events_own on wrong_events;
create policy wrong_events_own on wrong_events
  for all using (owns_child(child_id)) with check (owns_child(child_id));

comment on table wrong_events is
  '틀린 사건 하나가 한 줄. 오답노트(지금 상태)와 달리 덮어쓰지 않습니다';
comment on column wrong_events.source is
  'session = 정규 세션(attempts 있음) / review = 오답노트 복습(attempts 없음)';
comment on column wrong_events.content is
  '그때의 문제. 부모가 세트를 고쳐도 옛 사건이 미아가 되지 않게 박아 둡니다';
