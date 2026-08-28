import type { MetadataRoute } from 'next';

/**
 * 홈 화면에 아이콘으로 앉히기 위한 것입니다.
 *
 * 스토어 앱을 만들지 않는 대신 이게 필요합니다 —
 * 아이가 매일 여는 물건이 주소창을 거쳐야 하면 결국 안 엽니다.
 *
 * 서비스워커(오프라인 지원)는 일부러 두지 않습니다.
 * 문장을 읽어 주는 것이 서버라 오프라인에서는 받아쓰기가 성립하지 않고,
 * 캐시가 한 겹 더 끼면 고친 화면이 언제 반영되는지 알기 어려워집니다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '받아쓰기 공책',
    short_name: '받아쓰기',
    description: '듣고 쓰면, 틀린 곳을 한 글자씩 짚어 줘요',
    lang: 'ko',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbfaf6',
    theme_color: '#fbfaf6',
    // 아이 태블릿이 가로로 눕는 일이 잦은데, 원고지 15칸은 세로에 맞춰 재어 두었습니다.
    orientation: 'portrait',
    categories: ['education'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // 안드로이드가 아이콘을 원·사각형으로 잘라 쓰는 자리. 여백을 크게 준 판을 따로 줍니다.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
