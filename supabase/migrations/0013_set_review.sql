-- 확인 전 세트.
--
-- 급수표 한 장을 찍어 급마다 세트를 한꺼번에 만들어 둘 수 있습니다. 그런데 100문장을
-- 한자리에서 확인하라고 하면 부모는 훑고 넘어가고, 잘못 읽힌 글자가 그대로 정답이 됩니다.
-- 그래서 **만들어 두되 확인하기 전까지 아이에게 안 보이게** 하고, 차례가 되면 10문장씩 확인합니다.
--
-- 기본은 false 입니다. 지금까지 만든 세트와 한 장씩 넣는 세트는 넣는 자리에서 이미 확인했습니다.
alter table sets add column if not exists needs_review boolean not null default false;

-- AI가 고쳤거나 흐리다고 한 곳. 확인할 때 그 줄을 짚어 주려고 남겨 둡니다.
-- 확인을 마치면 비웁니다 — 할 일이 끝난 표시를 들고 있을 까닭이 없습니다.
alter table sets add column if not exists review_notes jsonb;
