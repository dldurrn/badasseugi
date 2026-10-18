-- ============================================================================
-- 어디서 왔나 — 가입한 집의 출처(인스타·블로그·카톡…)
--
-- 처음 들어온 순간의 출처를 쿠키(bs_src)에 기억했다가 가입할 때 한 번 적습니다.
--   · 이메일 가입: 가입 요청에 실어 보내고(user metadata) 아래 트리거가 옮겨 적음
--   · 카카오 가입: 돌아오는 자리(/auth/callback)에서 비어 있을 때만 적음
-- 이미 가입한 집은 비어 있습니다(「모름」). 거꾸로 알아낼 방법이 없습니다.
--
-- 값은 사용자가 보낸 것이라 규칙을 DB 에서도 겁니다 — 화면의 normalizeSource 와 같은 규칙.
-- ============================================================================

alter table families
  add column if not exists source text
  check (source is null or source ~ '^[a-z0-9-]{1,40}$');

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  src text := lower(new.raw_user_meta_data ->> 'source');
begin
  -- 규칙에 안 맞는 값은 가입을 막지 않고 버립니다. 출처 때문에 가입이 실패하면 안 됩니다.
  if src is null or src !~ '^[a-z0-9-]{1,40}$' then
    src := null;
  end if;
  insert into public.families (id, display_name, source)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', null), src)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 운영 현황 — 돌려주는 칸이 늘어 다시 만듭니다(반환 모양은 replace 로 못 바꿉니다).
drop function if exists admin_families();
create function admin_families()
returns table (
  family_id uuid,
  email_masked text,
  provider text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  children_count int,
  sets_count int,
  sessions_total int,
  last_active_on date,
  source text
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
    ),
    f.source
  from families f
  join auth.users u on u.id = f.id
  where is_admin()
    and not exists (select 1 from admin_users a where a.user_id = f.id)
  order by u.created_at desc;
$$;

revoke all on function admin_families() from public, anon;
grant execute on function admin_families() to authenticated;
