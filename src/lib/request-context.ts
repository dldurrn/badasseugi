import { cache } from 'react';
import { cookies } from 'next/headers';
import { ACTIVE_CHILD_COOKIE } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

/**
 * 한 요청 안에서 **같은 것을 두 번 물어보지 않게** 합니다.
 *
 * 화면 하나를 그리는 동안 여러 함수가 각자 도쿄를 다녀왔습니다.
 * 받아쓰기 세션 화면이 그랬습니다 —
 *
 *   프록시            로그인 확인      (네트워크)
 *   readActiveChild   자녀 행 조회
 *   readSettings      로그인 확인      (네트워크, **또**)
 *                     가족 행 조회
 *                     자녀 행 조회      (**또**)
 *
 * 같은 자녀 행을 두 번 읽고, 로그인 확인을 두 번 했습니다.
 * 도쿄 왕복은 한 번에 20~70ms이고 이것들이 **줄줄이** 일어나니 그대로 쌓입니다.
 * 서버가 식었을 때는 그 위에 부팅 값까지 얹힙니다.
 *
 * React의 `cache()`는 **요청 하나 안에서만** 결과를 기억합니다.
 * 사용자끼리 섞이지 않습니다 — 요청이 끝나면 버려집니다.
 *
 * **로그인 확인(`auth.getUser`)은 아예 뺐습니다.**
 * 프록시가 이미 문 앞에서 확인했고, RLS가 「자기 집 행만」을 데이터베이스에서 지킵니다
 * (`families_self`, `children_own`). 그러니 조회에 사용자 id를 얹을 필요가 없습니다 —
 * 얹지 않아도 남의 집 것은 애초에 안 나옵니다.
 * 쓰기에는 그대로 조건을 겁니다. 거기서는 명시가 안전장치 하나를 더 두는 값이 있습니다.
 */

/** 자녀 행 — 프로필과 설정을 한 번에 가져옵니다. 두 곳이 따로 읽던 것을 합쳤습니다. */
export interface ChildRow {
  id: string;
  nickname: string;
  avatar: string;
  pin_hash: string | null;
  rate: number | null;
  write_mode: string | null;
  voice: string | null;
}

export interface FamilyRow {
  parent_pin_hash: string | null;
  default_rate: number | null;
  default_write_mode: string | null;
  default_voice: string | null;
}

const CHILD_COLUMNS = 'id, nickname, avatar, pin_hash, rate, write_mode, voice';
const FAMILY_COLUMNS = 'parent_pin_hash, default_rate, default_write_mode, default_voice';

/**
 * 지금 고른 자녀의 행.
 *
 * 쿠키에 id가 없으면 아무것도 묻지 않습니다.
 * 프로필이 지워졌을 수 있어 쿠키 값을 그대로 믿지 않고 실제로 있는지 봅니다.
 */
export const activeChildRow = cache(async (): Promise<ChildRow | null> => {
  const childId = (await cookies()).get(ACTIVE_CHILD_COOKIE)?.value;
  if (!childId) return null;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('children')
      .select(CHILD_COLUMNS)
      .eq('id', childId)
      .maybeSingle();
    return (data as ChildRow | null) ?? null;
  } catch (error) {
    // 설정을 못 읽었다고 아이가 받아쓰기를 못 하면 안 됩니다.
    console.error('[request] 자녀 행을 읽지 못했습니다', error);
    return null;
  }
});

/** 우리 집 행. RLS 덕에 조건 없이 물어도 자기 것만 옵니다. */
export const familyRow = cache(async (): Promise<FamilyRow | null> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('families').select(FAMILY_COLUMNS).maybeSingle();
    return (data as FamilyRow | null) ?? null;
  } catch (error) {
    console.error('[request] 가족 행을 읽지 못했습니다', error);
    return null;
  }
});
