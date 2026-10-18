import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  ACTIVE_CHILD_COOKIE,
  VIEW_COOKIE,
  needsProfileSelection,
  parseView,
} from '@/lib/profile';
import { detectSource, SOURCE_COOKIE, SOURCE_COOKIE_MAX_AGE } from '@/lib/source';

/**
 * 세션 쿠키를 갱신하고, 두 개의 문을 지킵니다.
 *  1. 로그인하지 않았으면 로그인 화면으로.
 *  2. 아직 누가 쓰는지(보호자/어느 자녀) 고르지 않았으면 프로필 선택 화면으로.
 *
 * 서버 컴포넌트는 쿠키를 쓸 수 없으므로 이 프록시가 그 역할을 합니다.
 * (Next.js 16부터 `middleware.ts`가 `proxy.ts`로 이름이 바뀌었습니다.
 *  하는 일은 같고, 파일 이름과 내보내는 함수 이름만 바뀌었습니다.)
 */

/*
  로그인 전에도 열려야 하는 화면.

  약관이 여기 있는 것은 가입 화면에서 링크로 걸리기 때문입니다 —
  가입하기 전에 읽으라고 걸어 놓고, 누르면 로그인으로 돌려보내면 말이 안 됩니다.
*/
const PUBLIC_PATHS = ['/login', '/auth', '/privacy', '/terms'];

/** 프로필을 고르기 전에도 열려 있어야 하는 화면 (선택 화면 자체와 그 안의 흐름) */
const PROFILE_PATHS = ['/children'];

export async function proxy(request: NextRequest) {
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

  /*
    어디서 왔나(src/lib/source.ts) — **처음 온 순간**에만 적습니다.
    여기서 하는 이유: 첫 화면이 대개 곧바로 /login 으로 튕겨서, 그 화면에서는
    주소의 `?from=` 도 referrer 도 이미 사라진 뒤입니다. 그래서 튕기는 응답에도 쿠키를 얹습니다.
    로그인한 사람에게는 안 적습니다 — 이미 가입했으니 셀 것이 없습니다.
  */
  const source =
    user || request.cookies.has(SOURCE_COOKIE)
      ? null
      : detectSource({
          param: request.nextUrl.searchParams.get('from'),
          referrer: request.headers.get('referer'),
          userAgent: request.headers.get('user-agent'),
          ownHost: request.nextUrl.hostname,
        });
  const done = (res: NextResponse) => {
    if (source) {
      res.cookies.set(SOURCE_COOKIE, source, {
        path: '/',
        maxAge: SOURCE_COOKIE_MAX_AGE,
        sameSite: 'lax',
        // 이메일 가입은 화면에서 가입 요청에 실어 보내므로 화면이 읽을 수 있어야 합니다.
        // 개인정보가 아니라 「인스타」 같은 꼬리표뿐입니다.
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
      });
    }
    return res;
  };

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user) {
    if (isPublic) return done(response);
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return done(NextResponse.redirect(url));
  }

  if (pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return done(NextResponse.redirect(url));
  }

  if (isPublic) return done(response);

  const needsProfile = needsProfileSelection({
    view: parseView(request.cookies.get(VIEW_COOKIE)?.value),
    childId: request.cookies.get(ACTIVE_CHILD_COOKIE)?.value ?? null,
  });
  const isProfilePath = PROFILE_PATHS.some((p) => pathname.startsWith(p));

  if (needsProfile && !isProfilePath) {
    const url = request.nextUrl.clone();
    url.pathname = '/children';
    url.search = '';
    return done(NextResponse.redirect(url));
  }

  return done(response);
}

export const config = {
  /*
    manifest.webmanifest 을 빼는 것을 잊지 마세요.
    확장자가 png·svg 가 아니라 아래 규칙에 안 걸리는데, 이게 로그인으로 막히면
    아직 로그인하지 않은 기기에서 「홈 화면에 추가」가 이름도 아이콘도 없이 붙습니다.
  */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|webp)$).*)',
  ],
};
