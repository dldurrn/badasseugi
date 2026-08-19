import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { NICKNAME_MAX } from '@/lib/profile';

/** 라우트 핸들러 공통 — 로그인 확인과 입력값 다듬기. */

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AuthResult =
  | { ok: true; supabase: SupabaseServerClient; user: User }
  | { ok: false; response: NextResponse };

export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 }),
    };
  }
  return { ok: true, supabase, user };
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export { NICKNAME_MAX };

/**
 * 별명 다듬기. 줄바꿈과 연속 공백은 한 칸으로 눌러 둡니다.
 * 실명을 막을 방법은 없으므로 화면 안내로 부탁하고, 여기서는 길이만 지킵니다.
 */
export function normalizeNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.replace(/\s+/g, ' ').trim();
  if (value.length < 1 || value.length > NICKNAME_MAX) return null;
  return value;
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
