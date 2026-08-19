import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 서버 컴포넌트·라우트 핸들러에서 쓰는 Supabase 클라이언트.
 *
 * 서비스 롤 키는 여기서도 쓰지 않습니다.
 * 사용자 세션 기준으로 동작해야 RLS가 제 역할을 합니다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          list: Array<{ name: string; value: string; options?: CookieOptions }>,
        ) {
          try {
            for (const { name, value, options } of list) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없습니다. 미들웨어가 세션을 갱신합니다.
          }
        },
      },
    },
  );
}
