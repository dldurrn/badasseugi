-- ============================================================================
-- 운영 현황 — 운영자만 보는 이용 통계 (`/admin`)
--
-- **서비스 롤 키 없이** 여러 집을 가로질러 봅니다.
-- 서비스 롤 키는 RLS 를 통째로 우회해, 한 번 새면 모든 집이 열립니다.
-- 대신 아래 함수들이 security definer 로 돌면서 **스스로 운영자인지 확인하고**
-- 집계만 돌려줍니다. 화면에서 막는 게 아니라 DB 가 막으므로,
-- 누가 주소를 알고 들어와도 빈 결과만 받습니다.
--
-- **내용은 내보내지 않습니다.** 아이 별명·문장·점수는 없고 횟수와 날짜뿐입니다(절대 원칙 7).
-- 이메일도 앞 두 글자만 남기고 가립니다.
-- ============================================================================

-- 운영자 목록. 정책을 하나도 안 걸어서 API 로는 아무도 읽고 쓰지 못합니다.
-- 넣는 것은 Supabase SQL 편집기에서 손으로 합니다(이메일을 저장소에 적지 않으려고).
--   insert into admin_users (user_id) select id from auth.users where email = '...';
create table if not exists admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admin_users enable row level security;

create or replace function is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 집마다 한 줄. 운영자 자신의 집은 뺍니다 — 안 빼면 「꾸준함」 1등이 운영자입니다.
--
-- last_active_on 은 **기간 제한 없이** 셉니다. 활동 표(admin_activity)는 최근 몇 주만
-- 가져오므로, 그것만 보면 석 달 전에 쓰던 집이 「가입만 한 집」으로 보입니다.
-- 활동 = 끝까지 마친 세션, 소리 듣기, 사진 인식 중 하나라도 있었던 날.
-- 소리 듣기를 넣는 이유: 중간에 나간 세션과 듣고 고르기는 attempts 에 안 남습니다.
-- ---------------------------------------------------------------------------
create or replace function admin_families()
returns table (
  family_id uuid,
  email_masked text,
  provider text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  children_count int,
  sets_count int,
  sessions_total int,
  last_active_on date
)
language sql
stable
security definer set search_path = public, auth
as $$
  select
    f.id,
    case
      when u.email is null or u.email = '' then null
      else left(split_part(u.email, '@', 1), 2) || '***@' || split_part(u.email, '@', 2)
    end,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    u.created_at,
    u.last_sign_in_at,
    (select count(*)::int from children c where c.family_id = f.id),
    (select count(*)::int from sets s where s.family_id = f.id),
    (select count(*)::int from attempts t join children c on c.id = t.child_id
      where c.family_id = f.id),
    greatest(
      (select max((t.created_at at time zone 'Asia/Seoul')::date)
         from attempts t join children c on c.id = t.child_id where c.family_id = f.id),
      (select max(v.used_on) from tts_usage v where v.family_id = f.id and v.chars > 0),
      (select max(o.used_on) from ocr_usage o where o.family_id = f.id and o.count > 0)
    )
  from families f
  join auth.users u on u.id = f.id
  where is_admin()
    and not exists (select 1 from admin_users a where a.user_id = f.id)
  order by u.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 집 × 날짜(서울)마다 한 줄. `since` 이후만.
-- 날짜는 서울 기준입니다 — tts_usage·ocr_usage 의 used_on 도 서울 날짜로 적힙니다.
-- ---------------------------------------------------------------------------
create or replace function admin_activity(since date)
returns table (
  family_id uuid,
  day date,
  sessions int,
  exams int,
  dictation int,
  spelling int,
  tts_chars int,
  ocr int
)
language sql
stable
security definer set search_path = public
as $$
  with a as (
    select c.family_id as fid,
           (t.created_at at time zone 'Asia/Seoul')::date as d,
           count(*)::int as sessions,
           (count(*) filter (where t.mode = 'exam'))::int as exams,
           (count(*) filter (where t.module = 'dictation'))::int as dictation,
           (count(*) filter (where t.module = 'spelling'))::int as spelling
      from attempts t
      join children c on c.id = t.child_id
     where t.created_at >= (since::timestamp at time zone 'Asia/Seoul')
     group by 1, 2
  ),
  v as (
    select tu.family_id as fid, tu.used_on as d, tu.chars as chars
      from tts_usage tu where tu.used_on >= since and tu.chars > 0
  ),
  o as (
    select ou.family_id as fid, ou.used_on as d, ou.count as n
      from ocr_usage ou where ou.used_on >= since and ou.count > 0
  ),
  k as (
    select fid, d from a union select fid, d from v union select fid, d from o
  )
  select k.fid, k.d,
         coalesce(a.sessions, 0), coalesce(a.exams, 0),
         coalesce(a.dictation, 0), coalesce(a.spelling, 0),
         coalesce(v.chars, 0), coalesce(o.n, 0)
    from k
    left join a on a.fid = k.fid and a.d = k.d
    left join v on v.fid = k.fid and v.d = k.d
    left join o on o.fid = k.fid and o.d = k.d
   where is_admin()
     and not exists (select 1 from admin_users au where au.user_id = k.fid)
   order by k.d;
$$;

revoke all on function is_admin() from public, anon;
revoke all on function admin_families() from public, anon;
revoke all on function admin_activity(date) from public, anon;
grant execute on function is_admin() to authenticated;
grant execute on function admin_families() to authenticated;
grant execute on function admin_activity(date) to authenticated;
