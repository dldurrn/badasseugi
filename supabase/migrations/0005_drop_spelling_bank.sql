-- ---------------------------------------------------------------------------
-- 안 쓰는 맞춤법 문제은행 테이블 정리
--
-- 처음에는 맞춤법 문제를 DB에 두려 했습니다.
-- 그런데 실제로는 `src/data/spelling-bank.ts` 에 코드로 들어갔습니다.
-- 이유가 있습니다 — 문제은행에 테스트를 걸 수 있고(정답이 보기 안에 있나,
-- 찾기 문제의 보기를 이으면 원문이 되나), 배포마다 같은 것이 나가야 하니까요.
--
-- 그래서 이 테이블은 만들어진 뒤로 **한 줄도 들어간 적이 없습니다.**
-- 남겨 두면 다음에 보는 사람이 "맞춤법은 DB에 있구나" 하고 헛다리를 짚습니다.
--
-- 지우기 전에 확인한 것
--   - 코드에서 부르는 곳 없음 (`grep -rn spelling_bank src/` → 없음)
--   - 이 테이블을 가리키는 외래키 없음
--     wrong_notes.ref_id 가 주석에서만 언급하지, 실제 참조는 아닙니다
-- ---------------------------------------------------------------------------

drop policy if exists spelling_bank_read on spelling_bank;
drop index if exists spelling_bank_kind_idx;
drop table if exists spelling_bank;

-- 0001에 적힌 "맞춤법은 spelling_bank.id 문자열"이라는 설명도 더는 맞지 않습니다.
-- 지금 맞춤법 오답노트의 ref_id 는 코드에 적힌 문항 id(`dwae-1`, `find-5` 같은 것)입니다.
-- 받아쓰기는 문장 원문 그대로입니다 — 그래서 문장을 고치면 오답노트가 끊깁니다.
comment on column wrong_notes.ref_id is
  '받아쓰기는 문장 원문, 맞춤법은 코드의 문항 id (src/data/spelling-bank.ts)';
