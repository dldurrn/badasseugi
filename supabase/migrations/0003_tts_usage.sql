-- ============================================================================
-- 음성 읽어주기 사용량
--
-- 왜 세는가
-- 클로바 대신 Google Cloud TTS를 씁니다. 무료 한도(월 100만 자) 안에서 쓰는 게
-- 목표인데, "또박또박 듣기"는 어절마다 따로 호출하기 때문에 호출 수가
-- 생각보다 빠르게 늘어납니다. 5어절 문장 하나가 5번입니다.
--
-- 브라우저 캐시가 같은 문장 반복은 막아 주지만, 그것만 믿지 않고
-- 가족당 하루 상한을 서버에서도 걸어 둡니다. (사진 인식의 ocr_usage와 같은 방식)
-- 글자 수로 세는 이유는 과금 단위가 글자 수이기 때문입니다.
-- ============================================================================

create table if not exists tts_usage (
  family_id uuid not null references families (id) on delete cascade,
  used_on date not null default current_date,
  chars int not null default 0,
  primary key (family_id, used_on)
);

alter table tts_usage enable row level security;

drop policy if exists tts_usage_own on tts_usage;
create policy tts_usage_own on tts_usage
  for all using (family_id = auth.uid()) with check (family_id = auth.uid());
