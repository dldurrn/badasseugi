'use client';

import { useState } from 'react';
import { resetCoach } from '@/lib/coach';

/**
 * 안내를 다시 받고 싶을 때.
 *
 * **누른 자리에 그대로 머뭅니다.**
 * 예전에는 표시를 지우고 홈으로 밀어냈는데 두 가지가 어긋났습니다.
 *  - 누른 자리와 도착한 자리가 달라 「내가 왜 홈에 와 있지」가 됩니다.
 *  - 그리고 절반만 맞습니다. 문제 만들기·받아쓰기 안내는 어차피 그 화면에 가야 뜨는데,
 *    홈으로 보내 놓고 홈 것만 보여 주니까요.
 *
 * 이름도 「사용법 다시 보기」에서 바꿨습니다. 그건 **지금 보여 주겠다**는 약속인데
 * 이제 그렇지 않습니다. 약속과 동작이 어긋나면 고장으로 읽힙니다.
 *
 * 되돌리는 것은 이 기기 것뿐입니다 — 부모 폰에서 눌렀다고
 * 아이 태블릿의 안내가 되살아나지는 않습니다(안내는 기기별로 기억합니다).
 */
export function ShowGuideAgain() {
  const [done, setDone] = useState(false);

  return (
    <button
      onClick={() => {
        resetCoach();
        setDone(true);
      }}
      className="surface flex w-full items-center gap-4 p-4 text-left"
      aria-live="polite"
    >
      <div className="flex-1">
        <span className="display block text-base font-bold">
          {done ? '다시 켰어요' : '안내 다시 받기'}
        </span>
        <span
          className="mt-0.5 block text-xs"
          style={{ color: done ? 'var(--grid-deep)' : 'var(--ink-soft)' }}
        >
          {done
            ? '각 화면에 들어가면 어디를 누르면 되는지 짚어 줄게요'
            : '각 화면에 들어가면 다시 짚어 줘요'}
        </span>
      </div>
      {/*
        눌러도 화면이 안 바뀌므로, 바뀐 것이 눈에 보여야 합니다.
        아무 반응이 없으면 고장인 줄 알고 몇 번씩 더 누릅니다.
      */}
      <span aria-hidden="true" style={{ color: done ? 'var(--grid)' : 'var(--ink-faint)' }}>
        {done ? '✓' : '→'}
      </span>
    </button>
  );
}
