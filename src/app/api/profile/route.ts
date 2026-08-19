import { NextResponse } from 'next/server';
import { clearProfileCookies } from '@/lib/profile-server';

/**
 * 프로필 선택 지우기 — 로그아웃할 때 부릅니다.
 *
 * 로그인 확인을 걸지 않았습니다. 이 라우트가 하는 일은
 * 요청을 보낸 브라우저 자기 쿠키를 지우는 것뿐이고,
 * 로그아웃 뒤에 부르면 이미 세션이 없어 확인을 통과할 수 없기 때문입니다.
 */
export async function DELETE() {
  await clearProfileCookies();
  return NextResponse.json({ ok: true });
}
