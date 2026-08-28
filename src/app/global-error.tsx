'use client';

import { useEffect } from 'react';

/**
 * 레이아웃까지 깨졌을 때의 마지막 그물.
 *
 * `error.tsx`는 레이아웃 **안에서** 깨진 것을 받습니다.
 * 레이아웃 자체가 깨지면 그 그물은 펴지지도 않아서, 여기가 대신 받습니다.
 * 이 화면은 `<html>`부터 스스로 그려야 합니다 — 감쌀 레이아웃이 없으니까요.
 *
 * 그래서 globals.css 도 못 씁니다(레이아웃이 불러오던 것입니다).
 * 색과 글꼴을 여기에 직접 적습니다. 거의 안 나오는 화면이지만
 * 나왔을 때 영어 오류문만 덩그러니 있으면 부모가 겁먹습니다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        path: window.location.pathname + ' (레이아웃까지 깨짐)',
        stack: error.stack,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fbfaf6',
          color: '#232b33',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#a92e20', margin: 0 }}>
            앱을 여는 데 실패했어요
          </p>
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, color: '#656f7b' }}>
            잠깐 끊긴 것일 수 있어요. 다시 해 보고, 그래도 안 되면 잠시 뒤에 열어 주세요.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              width: '100%',
              padding: '16px 24px',
              fontSize: 17,
              fontWeight: 600,
              color: '#fff',
              background: '#2e7d5b',
              border: '1px solid #2e7d5b',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            다시 해 보기
          </button>
          {error.digest && (
            <p style={{ marginTop: 16, fontSize: 11, color: '#98a1ac' }}>
              문의할 때 이 번호를 함께 알려 주세요 · {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
