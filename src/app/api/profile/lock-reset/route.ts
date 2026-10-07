import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api';
import { LOCK_RESET_COOKIE, LOCK_RESET_MAX_AGE } from '@/lib/parent-lock';

/**
 * 「비밀번호를 잊었어요」 — 다시 로그인하러 나가기 전에 표시를 남깁니다.
 *
 * 표시만으로는 아무것도 풀리지 않습니다. 보호자 전환(`/api/profile/parent`)이
 * **표시를 남긴 뒤에 이 계정이 다시 로그인했는지**까지 확인하기 때문입니다.
 * 아이는 계정 비밀번호를 모르므로 다시 로그인할 수 없고, 그래서 이 길로는 못 들어옵니다.
 */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  (await cookies()).set(LOCK_RESET_COOKIE, String(Date.now()), {
    path: '/',
    maxAge: LOCK_RESET_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
  return NextResponse.json({ ok: true });
}
