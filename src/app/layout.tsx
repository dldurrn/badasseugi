import type { Metadata, Viewport } from 'next';
import './globals.css';
import { TabBar } from '@/components/TabBar';

/**
 * 카톡·문자에 링크를 붙였을 때 뜨는 카드가 여기서 나옵니다.
 *
 * 이 앱은 맘카페와 학부모 단톡방을 타고 퍼집니다. 「이거 좋더라」와 함께 던져지는
 * 링크인데 맨 주소만 뜨면 안 눌립니다. 스토어 앱을 안 만드는 만큼
 * **링크 한 줄이 앱 아이콘 노릇**을 해야 합니다.
 *
 * `metadataBase` 가 없으면 og:image 가 상대 주소로 나가 카톡이 못 읽습니다.
 * Vercel 이 넣어 주는 주소를 먼저 보고, 없으면 배포 주소로 떨어집니다.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, '')}`
  : 'https://badasseugi-wine.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: '받아쓰기 공책',
  description: '듣고 쓰면, 틀린 곳을 한 글자씩 짚어 줘요. 초등 저학년 받아쓰기·맞춤법 연습',
  applicationName: '받아쓰기 공책',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    siteName: '받아쓰기 공책',
    title: '받아쓰기 공책',
    description: '듣고 쓰면, 틀린 곳을 한 글자씩 짚어 줘요. 학교 문제지를 사진으로 넣을 수 있어요',
  },
  // iOS 홈 화면에서 주소창 없이 열립니다. 안드로이드 쪽은 manifest.ts 가 맡습니다.
  appleWebApp: {
    capable: true,
    title: '받아쓰기',
    statusBarStyle: 'default',
  },
  // 검색으로 오는 앱이 아니라 링크로 오는 앱이지만, 막을 이유도 없습니다.
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#fbfaf6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <TabBar />
      </body>
    </html>
  );
}
