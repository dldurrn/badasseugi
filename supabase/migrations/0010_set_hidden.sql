-- 아이별로 숨긴 문제 세트.
--
-- **보이는 아이가 아니라 숨긴 아이를 저장합니다.**
-- 「기본은 모두에게 보임」이 요구라서, 아무것도 저장하지 않은 상태가 곧 기본입니다.
--   · 새로 넣은 세트는 행이 없으니 모든 아이에게 보입니다
--   · 나중에 아이를 추가해도 옛 세트가 그 아이에게 보입니다
-- 「보이는 아이」를 저장하면 둘 다 코드로 채워 줘야 하고, 하나라도 빠지면 세트가 사라진 것처럼 보입니다.
--
-- 숨기는 것은 앞으로 목록에 안 나오게 할 뿐 **지난 기록은 건드리지 않습니다**
-- (점수·오답노트·리포트). 다시 켜면 최고 점수도 그대로 돌아옵니다.
create table if not exists set_hidden (
  set_id uuid not null references sets (id) on delete cascade,
  child_id uuid not null references children (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (set_id, child_id)
);

-- 「이 아이에게 숨긴 세트」를 아이 쪽에서 찾을 일이 있어 거꾸로도 하나 둡니다
create index if not exists set_hidden_child_idx on set_hidden (child_id);

alter table set_hidden enable row level security;

-- 아이와 세트가 모두 내 집 것이어야 합니다. 남의 집 세트 id 를 섞어 보내는 것을 DB 가 막습니다.
drop policy if exists set_hidden_own on set_hidden;
create policy set_hidden_own on set_hidden
  for all using (
    owns_child(child_id)
  ) with check (
    owns_child(child_id)
    and exists (select 1 from sets s where s.id = set_id and s.family_id = auth.uid())
  );
