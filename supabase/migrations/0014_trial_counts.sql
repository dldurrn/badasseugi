-- ============================================================================
-- 로그인 전 체험(`/try`) — 몇 명이 써 보고, 끝까지 하고, 가입하러 갔나
--
-- **횟수만 셉니다.** 누가 했는지·무엇을 썼는지는 남기지 않습니다(절대 원칙 7).
-- 쿠키도 기기 식별자도 없습니다 — 하루에 한 칸, 갈래마다 숫자 하나.
--
-- 실제 가입은 이미 `families.source` 로 셉니다. 여기 「cta」는 **가입하러 눌렀다**는 뜻이고,
-- 둘을 나란히 보면 「체험 → 가입 버튼 → 실제 가입」 어디서 새는지 보입니다.
-- ============================================================================

create table if not exists trial_counts (
  day date not null,
  event text not null check (event in ('start', 'finish', 'cta')),
  count int not null default 0,
  primary key (day, event)
);
-- 정책이 없어 API 로는 아무도 못 읽고 못 씁니다. 아래 두 함수만 지나갑니다.
alter table trial_counts enable row level security;

-- 로그인 안 한 사람도 부릅니다. 할 수 있는 일은 「오늘 칸에 1 더하기」 하나뿐입니다.
-- 누가 일부러 불러 숫자를 부풀릴 수는 있지만, 잃는 것은 통계 한 줄입니다.
create or replace function bump_trial(p_event text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_event not in ('start', 'finish', 'cta') then
    return;
  end if;
  -- 한국 날짜로 셉니다. 서버는 UTC 라 그냥 두면 아침 9시에 하루가 바뀝니다.
  insert into trial_counts (day, event, count)
  values ((now() at time zone 'Asia/Seoul')::date, p_event, 1)
  on conflict (day, event) do update set count = trial_counts.count + 1;
end;
$$;
grant execute on function bump_trial(text) to anon, authenticated;

create or replace function admin_trial_counts(since date)
returns table (day date, event text, count int)
language sql
stable
security definer set search_path = public
as $$
  select t.day, t.event, t.count
  from trial_counts t
  where is_admin() and t.day >= since
  order by t.day;
$$;
