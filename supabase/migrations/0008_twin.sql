-- 짝 문장 — 오답노트의 두 번째 걸음을 「같은 문장 한 번 더」에서
-- 「같은 규칙, 다른 문장」으로 바꿉니다.
--
-- 절대 원칙 5는 그대로입니다. 별 두 개, 연속, 하나라도 틀리면 0.
-- 바뀌는 것은 두 번째 문제의 출처뿐입니다.
-- 오히려 원칙이 적어 둔 목적("찍어서 맞힌 것을 거르기")에 더 가까워집니다 —
-- 같은 문장을 두 번 내면 찍기는 걸러도 **암기는 못 거릅니다.**
--
-- 새 테이블도, 새 정책도 없습니다. wrong_notes 는 이미 owns_child 로 막혀 있고
-- 여기 더하는 칸들도 같은 행에 붙으므로 그대로 보호됩니다.

-- 짝의 식별자. ref_id 와 **같은 규칙**입니다 —
-- 받아쓰기는 문장 원문, 맞춤법은 문제은행 문항 id.
alter table wrong_notes add column if not exists twin_ref text;

-- 짝을 만들어 보려 한 횟수.
--
-- twin_ref 가 비어 있는 것만으로는 「아직 안 만들었음」과 「만들려다 실패했음」을
-- 가릴 수 없습니다. 그러면 오답노트를 열 때마다 실패한 것을 또 만들려 들어
-- 될 리 없는 호출을 계속 던지게 됩니다. 두 번까지만 시도합니다.
alter table wrong_notes add column if not exists twin_tries smallint not null default 0;

-- 아이가 마지막으로 잘못 쓴 것.
--
-- 좋은 짝을 만들려면 오류 「유형」만으로는 모자랍니다.
-- error_types 에 batchim 이라고만 적혀 있으면 「받침 문제」까지밖에 모르는데,
-- **「닭」을 「닥」으로 썼다**를 알면 겹받침 ㄺ 을 놓친다는 것까지 알 수 있습니다.
--
-- 부모 리포트에서 「아이가 이렇게 썼어요」를 보여 줄 때도 씁니다.
-- 아이 것이지만 자기 집 행이라 owns_child 로 그대로 보호됩니다.
alter table wrong_notes add column if not exists last_wrong_input text;

comment on column wrong_notes.twin_ref is
  '짝 문제의 식별자. 받아쓰기는 문장 원문, 맞춤법은 문항 id (ref_id 와 같은 규칙)';
comment on column wrong_notes.twin_tries is
  '짝을 만들어 보려 한 횟수. 실패한 것을 무한히 다시 만들지 않기 위해';
comment on column wrong_notes.last_wrong_input is
  '아이가 마지막으로 잘못 쓴 것. 짝을 만들 때와 리포트에 씁니다';
