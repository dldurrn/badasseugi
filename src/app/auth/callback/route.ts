import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * 로그인 후 돌아오는 자리.
 *
 * 두 가지 경로를 모두 받습니다.
 *  - 카카오/OAuth: `?code=...`  → 코드를 세션으로 교환
 *  - 이메일 확인 메일: `?token_hash=...&type=...` → OTP 확인
 *
 * 실패하면 사용자에게 원인을 그대로 보여주지 않고
 * 로그인 화면에서 다음 행동을 안내합니다.
 */

/**
 * 돌아갈 주소는 우리 앱 안의 경로만 허용합니다.
 * `//evil.com` 같은 값이 들어오면 외부로 튕겨 나가므로 앞의 슬래시 개수까지 확인합니다.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  const failure = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));

  // 공급자가 거절한 경우 (사용자가 카카오 동의 화면에서 취소한 경우 포함)
  if (url.searchParams.get('error')) return failure('cancelled');

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure('exchange');
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return failure('expired');
  } else {
    return failure('missing');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failure('exchange');

  // 가족 행은 가입 트리거(handle_new_user)가 만들지만,
  // 트리거가 걸리기 전에 만들어진 계정도 있을 수 있어 여기서 한 번 더 확인합니다.
  // ignoreDuplicates로 두어 이미 있는 display_name을 덮어쓰지 않습니다.
  await supabase.from('families').upsert(
    {
      id: user.id,
      display_name:
        (user.user_metadata?.name as string | undefined) ??
        (user.user_metadata?.full_name as string | undefined) ??
        null,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );

  return NextResponse.redirect(new URL(next, url.origin));
}
