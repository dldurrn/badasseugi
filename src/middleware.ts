import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  ACTIVE_CHILD_COOKIE,
  VIEW_COOKIE,
  needsProfileSelection,
  parseView,
} from '@/lib/profile';

/**
 * 세션 쿠키를 갱신하고, 두 개의 문을 지킵니다.
 *  1. 로그인하지 않았으면 로그인 화면으로.
 *  2. 아직 누가 쓰는지(보호자/어느 자녀) 고르지 않았으면 프로필 선택 화면으로.
 *
 * 서버 컴포넌트는 쿠키를 쓸 수 없으므로 이 미들웨어가 그 역할을 합니다.
 */

const PUBLIC_PATHS = ['/login', '/auth', '/privacy'];

/** 프로필을 고르기 전에도 열려 있어야 하는 화면 (선택 화면 자체와 그 안의 흐름) */
const PROFILE_PATHS = ['/children'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          list: Array<{ name: string; value: string; options?: CookieOptions }>,
        ) {
          for (const { name, value } of list) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // API는 화면이 아니므로 리다이렉트하지 않습니다.
  // 각 라우트가 직접 401을 돌려주어야 fetch 쪽에서 원인을 알 수 있습니다.
  if (pathname.startsWith('/api')) return response;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (isPublic) return response;

  const needsProfile = needsProfileSelection({
    view: parseView(request.cookies.get(VIEW_COOKIE)?.value),
    childId: request.cookies.get(ACTIVE_CHILD_COOKIE)?.value ?? null,
  });
  const isProfilePath = PROFILE_PATHS.some((p) => pathname.startsWith(p));

  if (needsProfile && !isProfilePath) {
    const url = request.nextUrl.clone();
    url.pathname = '/children';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'],
};
