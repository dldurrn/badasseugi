/**
 * 어디서 왔나 — 가입한 집이 인스타·블로그·카톡 중 어디를 거쳐 왔는지.
 *
 * **링크에 직접 붙인 꼬리표(`?from=insta`)가 먼저입니다.**
 * 브라우저가 알려 주는 출처(referrer)는 인스타·카톡 앱 안의 브라우저가 자주 지워서,
 * 그것만 믿으면 대부분 「모름」이 됩니다. 꼬리표가 없을 때만 referrer → 앱 이름(UA) 순으로 짐작합니다.
 *
 * **처음 온 곳**을 셉니다. 쿠키가 이미 있으면 덮어쓰지 않습니다 —
 * 인스타에서 알고 블로그 글을 읽고 가입했다면, 데려온 것은 인스타입니다.
 *
 * 화면(가입 폼)에서도 읽으므로 node 전용 모듈을 들이지 마세요.
 */

export const SOURCE_COOKIE = 'bs_src';
/** 처음 와서 가입까지 이만큼은 기다려 줍니다. 훑어보고 며칠 뒤 가입하는 부모가 많습니다. */
export const SOURCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** DB 의 check 제약과 같은 규칙입니다(0012). 어긋나면 가입 트리거가 값을 버립니다. */
const SOURCE_PATTERN = /^[a-z0-9-]{1,40}$/;

/** 아무 값이나 저장하지 않게 다듬습니다. 대문자는 낮추고, 규칙에 안 맞으면 버립니다. */
export function normalizeSource(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  return SOURCE_PATTERN.test(value) ? value : null;
}

/** referrer 주소로 짐작합니다. 우리 사이트 안에서 옮겨 다닌 것은 출처가 아닙니다. */
export function sourceFromReferrer(referrer: string | null | undefined, ownHost: string): string | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  const own = ownHost.toLowerCase().replace(/^www\./, '').split(':')[0];
  if (host === own || host.endsWith(`.${own}`) || host.endsWith('.vercel.app')) return null;
  if (host.includes('instagram.com')) return 'insta';
  if (host === 'blog.naver.com' || host === 'm.blog.naver.com') return 'blog';
  if (host.includes('naver.com')) return 'naver';
  if (host.includes('kakao')) return 'kakao';
  if (host.includes('google.')) return 'google';
  if (host.includes('daum.net')) return 'daum';
  return 'etc';
}

/**
 * 앱 안의 브라우저 이름으로 짐작합니다 — referrer 가 지워져도 이건 남습니다.
 * 네이버 앱은 블로그와 검색이 같은 앱이라 가리지 못해 「naver」로 둡니다.
 */
export function sourceFromUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  if (/Instagram/i.test(ua)) return 'insta';
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/NAVER\(inapp/i.test(ua)) return 'naver';
  return null;
}

export function detectSource(input: {
  param: string | null;
  referrer: string | null;
  userAgent: string | null;
  ownHost: string;
}): string | null {
  return (
    normalizeSource(input.param) ??
    sourceFromReferrer(input.referrer, input.ownHost) ??
    sourceFromUserAgent(input.userAgent)
  );
}

/** `document.cookie` 같은 문자열에서 출처를 꺼냅니다. */
export function readSourceCookie(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SOURCE_COOKIE) return normalizeSource(decodeURIComponent(rest.join('=')));
  }
  return null;
}

const SOURCE_LABEL: Record<string, string> = {
  insta: '인스타',
  blog: '블로그',
  kakao: '카톡',
  naver: '네이버',
  google: '구글',
  daum: '다음',
  etc: '다른 사이트',
};

/**
 * 운영 현황에 쓸 이름. `blog-3`처럼 갈래를 붙였으면 「블로그 · 3」.
 * 꼬리표는 영문 소문자·숫자·하이픈만 됩니다 — 한글을 넣으면 주소에서 깨져 오다가 버려집니다.
 */
export function sourceLabel(source: string | null): string {
  if (!source) return '모름';
  if (SOURCE_LABEL[source]) return SOURCE_LABEL[source];
  const [head, ...rest] = source.split('-');
  return SOURCE_LABEL[head] && rest.length ? `${SOURCE_LABEL[head]} · ${rest.join('-')}` : source;
}
