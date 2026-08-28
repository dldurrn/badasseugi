'use client';

import { useRouter } from 'next/navigation';
import { resetCoach } from '@/lib/coach';

/**
 * 사용법을 다시 보고 싶을 때.
 *
 * 안내가 화면마다 흩어져 있어서, 여기서는 표시만 되돌리고 홈으로 보냅니다.
 * 홈에서 첫 안내가 다시 뜨고, 문제 만들기·받아쓰기 화면에 들어가면 거기 것이 또 뜹니다.
 *
 * 되돌리는 것은 이 기기 것뿐입니다 — 부모 폰에서 눌렀다고
 * 아이 태블릿의 안내가 되살아나지는 않습니다.
 */
export function ShowGuideAgain() {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        resetCoach();
        router.push('/');
      }}
      className="surface flex w-full items-center gap-4 p-4 text-left"
    >
      <div className="flex-1">
        <span className="display block text-base font-bold">사용법 다시 보기</span>
        <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
          화면마다 어디를 누르면 되는지 다시 짚어 줘요
        </span>
      </div>
      <span aria-hidden="true" style={{ color: 'var(--ink-faint)' }}>
        →
      </span>
    </button>
  );
}
