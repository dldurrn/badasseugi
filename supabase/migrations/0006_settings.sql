-- ============================================================================
-- 설정을 서버에 둡니다 — 아이마다 따로, 기기가 달라도 따라오게
--
-- 왜 필요한가
--
-- 지금까지 설정은 브라우저 한 곳(localStorage)에 통으로 저장했습니다.
-- 그래서 두 가지가 안 됐습니다.
--
--   1. 아이가 둘이면 한 값을 같이 씁니다. 아이별로 나눌 자리가 없었습니다.
--   2. 부모 휴대폰에서 정한 것이 아이 패드로 넘어가지 않습니다.
--      부모는 「분명히 목소리를 골랐는데 아이 화면에서는 다른 소리가 난다」고 겪습니다.
--
-- 실제로 이 집은 부모가 휴대폰, 아이가 패드나 노트북을 씁니다.
-- 기기가 다르니 브라우저에 두는 방식으로는 될 수가 없습니다.
--
-- 어떻게 나누는가
--
--   families  — 부모가 정하는 **기본값**. 아이가 따로 고르지 않았으면 이것을 씁니다.
--   children  — 그 아이가 **직접 고른 값**. 비어 있으면 위의 기본값으로 내려갑니다.
--
-- 값이 없을 때(null)를 「안 골랐음」으로 씁니다.
-- 기본값을 미리 채워 넣지 않는 이유는, 그러면 부모가 나중에 기본값을 바꿔도
-- 이미 채워진 아이들에게는 안 닿기 때문입니다. null로 두어야 따라옵니다.
--
-- 효과음은 여기 두지 않습니다. 그건 「지금 이 자리에서 조용히 해야 하나」라서
-- 아이의 성향이 아니라 그 순간의 사정입니다. 기기에 그대로 둡니다.
-- ============================================================================

-- 읽는 속도 — 화면이 쓰는 값은 0.65 / 0.85 / 1.0 셋뿐입니다.
-- 범위로만 막아 둡니다. 나중에 값을 하나 더 늘릴 때 마이그레이션을 또 돌리지 않도록.
alter table families add column if not exists default_rate real
  check (default_rate is null or (default_rate >= 0.5 and default_rate <= 2));
alter table children add column if not exists rate real
  check (rate is null or (rate >= 0.5 and rate <= 2));

-- 받아쓰기 쓰는 방법 — 원고지 / 그냥 쓰기
alter table families add column if not exists default_write_mode text
  check (default_write_mode is null or default_write_mode in ('wongoji', 'plain'));
alter table children add column if not exists write_mode text
  check (write_mode is null or write_mode in ('wongoji', 'plain'));

-- 목소리 — 회사마다 형태가 달라(ko-KR-… / tc_…) 값 검사는 하지 않습니다.
-- 서버가 읽을 때 지금 회사의 형태와 맞는지 보고, 안 맞으면 남녀를 지켜 옮깁니다
-- (src/lib/tts-engines.ts 의 matchVoice).
alter table families add column if not exists default_voice text;
alter table children add column if not exists voice text;

-- ---------------------------------------------------------------------------
-- 권한
--
-- children 은 이미 부모(family_id = auth.uid())만 읽고 쓸 수 있게 되어 있고,
-- families 도 자기 행만 다룹니다. 칸만 늘렸으니 정책은 그대로 둡니다.
--
-- 자녀 화면에서도 자기 설정을 바꿀 수 있어야 하는데, 자녀는 계정이 없습니다.
-- 그래서 화면이 직접 테이블을 만지지 않고 `/api/settings` 를 거칩니다 —
-- 거기서 지금 고른 자녀(bs_child 쿠키)의 행만 건드립니다.
-- ---------------------------------------------------------------------------

comment on column families.default_rate is '부모가 정한 기본 읽기 속도. null이면 앱 기본값(1.0)';
comment on column families.default_write_mode is '부모가 정한 기본 쓰기 방법. null이면 원고지';
comment on column families.default_voice is '부모가 정한 기본 목소리. null이면 회사 기본 목소리';
comment on column children.rate is '이 아이가 고른 읽기 속도. null이면 families.default_rate';
comment on column children.write_mode is '이 아이가 고른 쓰기 방법. null이면 families.default_write_mode';
comment on column children.voice is '이 아이가 고른 목소리. null이면 families.default_voice';
