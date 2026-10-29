import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/site';

/**
 * 검색 엔진에게 사이트 지도가 어디 있는지 알려 줍니다.
 *
 * 한동안 이 파일이 없어서 `/robots.txt` 가 로그인 화면으로 튕겼습니다(307).
 * 네이버 서치어드바이저·구글이 사이트 지도를 못 찾아, 로그인 전 체험(`/try`)이 검색에 안 잡혔습니다.
 * 프록시 matcher 에서도 빼 두었습니다 — 거기 걸리면 이 파일이 있어도 다시 튕깁니다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 로그인 뒤 화면은 어차피 로그인으로 튕기니 긁어 가 봐야 로그인 화면뿐입니다
      disallow: ['/api/', '/admin'],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
