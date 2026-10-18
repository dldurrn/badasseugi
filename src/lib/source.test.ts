import { describe, expect, it } from 'vitest';
import {
  detectSource,
  normalizeSource,
  readSourceCookie,
  sourceFromReferrer,
  sourceFromUserAgent,
  sourceLabel,
} from './source';

const HOST = 'badasseugi.com';
const KAKAO_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5';
const INSTA_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0';

describe('꼬리표 다듬기', () => {
  it('대문자는 낮추고 규칙에 맞는 것만 받습니다', () => {
    expect(normalizeSource(' Insta ')).toBe('insta');
    expect(normalizeSource('blog-3')).toBe('blog-3');
    expect(normalizeSource('블로그')).toBeNull();
    expect(normalizeSource('a b')).toBeNull();
    expect(normalizeSource('x'.repeat(41))).toBeNull();
    expect(normalizeSource('')).toBeNull();
  });
});

describe('짐작하기', () => {
  it('referrer 로 갈래를 가립니다', () => {
    expect(sourceFromReferrer('https://l.instagram.com/?u=x', HOST)).toBe('insta');
    expect(sourceFromReferrer('https://m.blog.naver.com/abc/123', HOST)).toBe('blog');
    expect(sourceFromReferrer('https://search.naver.com/search.naver?q=x', HOST)).toBe('naver');
    expect(sourceFromReferrer('https://www.google.com/', HOST)).toBe('google');
    expect(sourceFromReferrer('https://example.org/', HOST)).toBe('etc');
  });

  it('우리 사이트 안에서 옮겨 다닌 것은 출처가 아닙니다', () => {
    expect(sourceFromReferrer('https://badasseugi.com/login', HOST)).toBeNull();
    expect(sourceFromReferrer('https://www.badasseugi.com/', HOST)).toBeNull();
    expect(sourceFromReferrer('https://badasseugi-wine.vercel.app/', HOST)).toBeNull();
    expect(sourceFromReferrer('not a url', HOST)).toBeNull();
  });

  it('앱 안 브라우저 이름으로 짐작합니다', () => {
    expect(sourceFromUserAgent(KAKAO_UA)).toBe('kakao');
    expect(sourceFromUserAgent(INSTA_UA)).toBe('insta');
    expect(sourceFromUserAgent('Mozilla/5.0 Chrome/120 Safari/537.36')).toBeNull();
  });

  it('꼬리표 → referrer → 앱 이름 순으로 봅니다', () => {
    expect(
      detectSource({ param: 'blog', referrer: 'https://l.instagram.com/', userAgent: KAKAO_UA, ownHost: HOST }),
    ).toBe('blog');
    expect(
      detectSource({ param: '한글', referrer: 'https://l.instagram.com/', userAgent: KAKAO_UA, ownHost: HOST }),
    ).toBe('insta');
    // 카톡 안 브라우저는 referrer 를 지웁니다
    expect(detectSource({ param: null, referrer: null, userAgent: KAKAO_UA, ownHost: HOST })).toBe('kakao');
    expect(detectSource({ param: null, referrer: null, userAgent: null, ownHost: HOST })).toBeNull();
  });
});

describe('쿠키와 이름', () => {
  it('쿠키 문자열에서 꺼냅니다', () => {
    expect(readSourceCookie('a=1; bs_src=insta; b=2')).toBe('insta');
    expect(readSourceCookie('a=1')).toBeNull();
    expect(readSourceCookie('bs_src=%EB%B8%94')).toBeNull();
  });

  it('운영 현황에 쓸 이름', () => {
    expect(sourceLabel('insta')).toBe('인스타');
    expect(sourceLabel('blog-3')).toBe('블로그 · 3');
    expect(sourceLabel('mamcafe')).toBe('mamcafe');
    expect(sourceLabel(null)).toBe('모름');
  });
});
