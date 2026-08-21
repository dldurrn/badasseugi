'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * 로그아웃.
 *
 * 프로필 선택 쿠키를 **먼저** 지웁니다.
 * 로그아웃한 뒤에는 세션이 없어 서버 라우트를 부를 수 없고,
 * 쿠키가 남아 있으면 다음에 다른 계정으로 들어와도 엉뚱한 프로필을 가리키게 됩니다.
 *
 * 부르는 곳이 둘입니다 — 설정의 로그아웃, 프로필 화면의 "다른 계정으로 로그인".
 * 순서를 한 곳에서만 관리하려고 따로 빼 두었습니다.
 */
export async function signOutAndGoToLogin(): Promise<void> {
  await fetch('/api/profile', { method: 'DELETE' }).catch(() => null);
  await createClient().auth.signOut();
  // 쿠키가 방금 바뀌었으니 전체 새로고침으로 넘어갑니다.
  window.location.replace('/login');
}
