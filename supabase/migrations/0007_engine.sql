-- 어느 회사 목소리로 읽을지 부모가 고를 수 있게 합니다.
--
-- 지금까지는 환경 변수가 정했습니다(TYPECAST_API_KEY 가 있으면 타입캐스트).
-- 그건 바꾸려면 배포를 다시 해야 한다는 뜻이라, 부모가 두 소리를 견주어
-- 고를 방법이 없었습니다. 같은 문장을 두 회사로 들어 봐야 판단이 섭니다.
--
-- **집 단위입니다.** 아이마다 다른 회사를 쓸 까닭이 없고,
-- 이건 아이의 학습 취향이 아니라 집의 선택(소리 질과 비용)입니다.
-- 그래서 children 에는 칸을 두지 않습니다 — 안 쓰는 칸을 만들지 않습니다.
--
-- 비어 있으면 'auto' 로 봅니다. 기존 집들은 지금까지와 똑같이 굴러갑니다.
alter table families add column if not exists default_engine text
  check (default_engine in ('auto', 'typecast', 'google'));

comment on column families.default_engine is
  '목소리 회사 고르기. auto = 서버가 정한 순서대로. 비어 있으면 auto.';
