'use client';

import { useEffect } from 'react';

/**
 * 문제를 푸는 중에 화면을 벗어나려 할 때 한 번 물어봅니다.
 *
 * 화면 안의 ← 버튼만 막아서는 부족합니다.
 * 새로고침(F5), 브라우저 뒤로가기, 탭 닫기로도 빠져나갈 수 있고
 * 그렇게 나가면 끝까지 푼 것이 아니라 기록이 남지 않습니다(절대 원칙 2).
 * 아이가 실수로 한 번 누르면 처음부터 다시 해야 하는 자리라 막아 둡니다.
 *
 * 뒤로가기를 막는 방법:
 * 들어올 때 히스토리에 가짜 항목을 하나 쌓아 둡니다.
 * 뒤로가기를 누르면 그 가짜 항목이 먼저 빠지면서 popstate가 오는데,
 * 이때 물어보고 머무르겠다면 가짜 항목을 다시 쌓습니다.
 *
 * 새로고침·탭 닫기는 브라우저가 정한 문구만 보여줍니다(우리 문장을 넣을 수 없습니다).
 */
export function useLeaveGuard(active: boolean, message: string): void {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 오래된 브라우저는 returnValue를 봅니다.
      event.returnValue = '';
    };

    const onPopState = () => {
      if (window.confirm(message)) {
        // 나가기를 택함 — 가드를 풀고 실제로 뒤로 보냅니다.
        window.removeEventListener('beforeunload', onBeforeUnload);
        window.removeEventListener('popstate', onPopState);
        window.history.back();
      } else {
        // 머무름 — 가짜 항목을 다시 쌓아 다음 뒤로가기도 잡습니다.
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [active, message]);
}

/** 나가기 확인 문구. 화면 안 ← 버튼과 같은 말을 써야 아이가 헷갈리지 않습니다. */
export const LEAVE_MESSAGE =
  '지금 나가면 이번 기록은 저장되지 않아요.\n별과 점수는 끝까지 마쳐야 받을 수 있어요.\n\n나갈까요?';
