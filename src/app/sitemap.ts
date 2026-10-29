import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/site';

/**
 * 로그인 전에 열리는 화면만 싣습니다. 나머지는 열면 로그인으로 튕깁니다.
 * `/` 는 싣지 않습니다 — 로그인 안 한 방문은 `/try` 로 넘어가므로(프록시) 같은 화면이 두 번 잡힙니다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_ORIGIN}/try`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_ORIGIN}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_ORIGIN}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
