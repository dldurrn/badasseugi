'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 짝이 없는 오답노트를 조용히 채웁니다.
 *
 * 아무것도 그리지 않습니다. 「만드는 중…」 같은 것을 띄우면
 * 아이는 뭔가 준비가 안 됐다고 느끼고 기다립니다 —
 * **없어도 지금 바로 풀 수 있는데** 말이죠.
 *
 * 채워진 게 있을 때만 목록을 다시 그립니다.
 * 언제나 다시 그리면 화면을 열 때마다 깜빡이고, 채울 게 없는 집에서는 헛일입니다.
 */
export function TwinFill() {
  const router = useRouter();
  // React 가 개발 중에 효과를 두 번 태워도 한 번만 부릅니다.
  const 불렀나 = useRef(false);

  useEffect(() => {
    if (불렀나.current) return;
    불렀나.current = true;

    void fetch('/api/twin', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : { filled: 0 }))
      .then((payload: { filled?: number }) => {
        if ((payload.filled ?? 0) > 0) router.refresh();
      })
      .catch(() => {
        // 짝이 없어도 원본을 두 번 풀어 졸업합니다. 알릴 것이 없습니다.
      });
  }, [router]);

  return null;
}
