'use client';

import { STARS_TO_GRADUATE } from '@/lib/review';

/**
 * 오답노트 졸업 진행 표시.
 * 별 두 개가 규칙 그 자체라, 숫자 대신 별을 직접 보여줘서
 * 설명 없이도 "하나 더 모으면 된다"가 읽히게 합니다.
 */
export function Stars({ streak, size = 20 }: { streak: number; size?: number }) {
  const filled = Math.max(0, Math.min(STARS_TO_GRADUATE, streak));
  return (
    <span
      className="inline-flex gap-0.5"
      role="img"
      aria-label={`별 ${filled}개, 모두 ${STARS_TO_GRADUATE}개 필요`}
    >
      {Array.from({ length: STARS_TO_GRADUATE }, (_, i) => (
        <Star key={i} filled={i < filled} size={size} />
      ))}
    </span>
  );
}

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.2l2.7 5.5 6 .9-4.35 4.24 1.03 6.01L12 17.03 6.62 19.85l1.03-6.01L3.3 9.6l6-.9L12 3.2z"
        fill={filled ? 'var(--gold)' : 'none'}
        stroke={filled ? 'var(--gold)' : 'var(--rule-strong)'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
