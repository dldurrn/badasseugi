import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  ACTIVE_CHILD_COOKIE,
  PARENT_GRACE_COOKIE,
  PARENT_GRACE_MAX_AGE,
  PROFILE_COOKIE_MAX_AGE,
  VIEW_COOKIE,
  parseView,
  type ViewMode,
} from '@/lib/profile';
import type { ChildProfile } from '@/lib/types';

/** 서버에서만 쓰는 프로필 조회·저장. pin_hash는 여기서 걸러 내고 밖으로 내보내지 않습니다. */

interface ChildRow {
  id: string;
  nickname: string;
  avatar: string;
  pin_hash: string | null;
}

const SAFE_COLUMNS = 'id, nickname, avatar, pin_hash';

function toProfile(row: ChildRow): ChildProfile {
  // 해시 자체는 화면에 필요 없습니다. 잠금 여부만 있으면 됩니다.
  return {
    id: row.id,
    nickname: row.nickname,
    avatar: row.avatar,
    hasPin: Boolean(row.pin_hash),
  };
}

export async function listChildren(): Promise<ChildProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('children')
    .select(SAFE_COLUMNS)
    .order('created_at', { ascending: true });
  return (data ?? []).map((row) => toProfile(row as ChildRow));
}

export async function getChild(id: string): Promise<ChildProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('children')
    .select(SAFE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  return data ? toProfile(data as ChildRow) : null;
}

export interface ActiveProfile {
  view: ViewMode | null;
  /**
   * 마지막으로 고른 자녀. 보호자 화면에서도 값이 남아 있습니다(리포트에서 쓰려고).
   * "지금 아이가 풀고 있는 중"인지 판단하려면 view === 'child' 도 같이 봐야 합니다.
   */
  child: ChildProfile | null;
}

export async function readActiveProfile(): Promise<ActiveProfile> {
  const store = await cookies();
  const view = parseView(store.get(VIEW_COOKIE)?.value);
  const childId = store.get(ACTIVE_CHILD_COOKIE)?.value;

  if (!childId) return { view, child: null };

  // 프로필이 지워졌을 수 있으므로 쿠키 값을 그대로 믿지 않고 다시 확인합니다.
  return { view, child: await getChild(childId) };
}

/** 세션 화면에서 쓸 자녀. 자녀 모드가 아니면 null 입니다. */
export async function readActiveChild(): Promise<ChildProfile | null> {
  const { view, child } = await readActiveProfile();
  return view === 'child' ? child : null;
}

export async function setProfileCookies(next: {
  view: ViewMode;
  childId?: string | null;
}): Promise<void> {
  const store = await cookies();
  const options = {
    path: '/',
    maxAge: PROFILE_COOKIE_MAX_AGE,
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  };

  store.set(VIEW_COOKIE, next.view, options);
  if (next.childId === null) store.delete(ACTIVE_CHILD_COOKIE);
  else if (next.childId) store.set(ACTIVE_CHILD_COOKIE, next.childId, options);
}

export async function clearProfileCookies(): Promise<void> {
  const store = await cookies();
  store.delete(VIEW_COOKIE);
  store.delete(ACTIVE_CHILD_COOKIE);
  store.delete(PARENT_GRACE_COOKIE);
}

/* ------------------------------------------------------------ 보호자 잠금 */

/** 잠금이 걸려 있는지. 해시 자체는 절대 밖으로 내보내지 않습니다. */
export async function isParentLocked(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('families')
    .select('parent_pin_hash')
    .eq('id', user.id)
    .maybeSingle();

  return Boolean(data?.parent_pin_hash);
}

export async function readParentPinHash(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('families')
    .select('parent_pin_hash')
    .eq('id', user.id)
    .maybeSingle();

  return (data?.parent_pin_hash as string | null) ?? null;
}

export async function hasParentGrace(): Promise<boolean> {
  const store = await cookies();
  return store.get(PARENT_GRACE_COOKIE)?.value === '1';
}

export async function grantParentGrace(): Promise<void> {
  const store = await cookies();
  store.set(PARENT_GRACE_COOKIE, '1', {
    path: '/',
    maxAge: PARENT_GRACE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function revokeParentGrace(): Promise<void> {
  const store = await cookies();
  store.delete(PARENT_GRACE_COOKIE);
}
