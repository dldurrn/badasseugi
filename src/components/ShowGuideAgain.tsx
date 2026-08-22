'use client';

import { useRouter } from 'next/navigation';
import { resetOnboarding } from './Onboarding';

/**
 * 사용법을 다시 보고 싶을 때.
 *
 * 안내는 홈에 뜨므로, 표시만 되돌린 뒤 홈으로 보냅니다.
 * 여기서 안내를 그대로 펼치면 "홈에서 보던 그 안내"와 자리가 달라져
 * 나중에 또 찾을 때 헷갈립니다.
 */
export function ShowGuideAgain() {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        resetOnboarding();
        router.push('/');
      }}
      className="surface flex w-full items-center gap-4 p-4 text-left"
    >
      <div className="flex-1">
        <span className="display block text-base font-bold">사용법 다시 보기</span>
        <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
          처음에 나왔던 안내를 홈에서 다시 봐요
        </span>
      </div>
      <span aria-hidden="true" style={{ color: 'var(--ink-faint)' }}>
        →
      </span>
    </button>
  );
}
