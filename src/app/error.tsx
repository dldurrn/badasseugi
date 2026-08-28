'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * 화면이 깨졌을 때.
 *
 * 두 가지를 합니다.
 *   1. 서버에 알립니다 — 그러지 않으면 남의 집에서 깨진 것을 아무도 모릅니다.
 *   2. 아이가 **다음에 할 일**을 줍니다.
 *
 * Next의 기본 화면은 영어 오류문과 흰 바탕입니다.
 * 아이가 그걸 보면 자기가 뭘 잘못한 줄 압니다.
 *
 * 「다시 해 보기」를 먼저 둡니다. 깨진 것의 상당수는 잠깐 끊긴 것이라
 * 한 번 더 누르면 됩니다. 그래도 안 되면 홈으로 나갈 길을 함께 둡니다.
 */
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 기다리지 않습니다. 알리려다 또 걸리면 화면이 두 번 죽습니다.
    void fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        path: window.location.pathname,
        stack: error.stack,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <main className="page">
      <div className="surface mt-12 p-6 text-center">
        <p className="display text-lg font-bold" style={{ color: 'var(--pen-deep)' }}>
          화면을 여는 데 실패했어요
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          잠깐 끊긴 것일 수 있어요. 다시 해 보고, 그래도 안 되면 홈으로 가 주세요.
        </p>

        <button onClick={reset} className="btn btn-primary btn-lg mt-5">
          다시 해 보기
        </button>
        <Link href="/" className="btn btn-quiet mt-2 w-full justify-center">
          홈으로
        </Link>

        {/*
          오류 식별자를 작게 남깁니다.
          부모가 문의할 때 이 글자를 함께 보내 주면 서버 기록에서 바로 찾을 수 있습니다.
        */}
        {error.digest && (
          <p className="mt-4 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
            문의할 때 이 번호를 함께 알려 주세요 · {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
