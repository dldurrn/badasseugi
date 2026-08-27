'use client';

import { useEffect, useState } from 'react';

/**
 * 채점 결과를 보고 넘어가는 버튼.
 *
 * **틀렸을 때만 잠깐 잠급니다.**
 *
 * 아이는 문제를 풀고 나면 「다음」 자리를 손가락으로 기억합니다.
 * 그래서 채점 화면이 뜨는 순간 이미 그 자리를 누르고 있습니다 —
 * 정답이 화면에 떠 있었는데도 못 보고 지나갑니다.
 * 오답노트에 쌓이기는 하지만, **틀린 그 자리에서 정답을 한 번 보는 것**이
 * 나중에 오답노트를 푸는 것보다 훨씬 값쌉니다.
 *
 * 맞았을 때는 잠그지 않습니다.
 * 맞은 아이를 기다리게 하면 상을 주는 자리가 벌 서는 자리가 됩니다.
 *
 * 남은 시간을 숫자로 보여 주는 이유는 **고장이 아니라는 것**을 알리기 위해서입니다.
 * 눌리지 않는 버튼만 있으면 아이는 더 세게, 더 여러 번 누릅니다.
 */

/**
 * 2초.
 *
 * 3초를 재어 보면 저학년에게도 길고, 그만큼 「다음」을 연타하게 만듭니다.
 * 1초는 화면이 바뀌는 것을 알아차리기도 전에 풀립니다.
 * 정답 한 줄에 눈이 닿기에는 2초면 됩니다.
 */
const HOLD_MS = 2000;

interface NextButtonProps {
  /** 틀렸는가. 참일 때만 잠깁니다. */
  hold: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  /**
   * 잠긴 동안 버튼에 띄울 말.
   *
   * 기본은 「정답을 보고 넘어가요」인데, 넘어가는 게 아니라 접는 자리도 있습니다 —
   * 오답노트에서는 이 버튼이 「닫기」입니다. 거기서 「넘어가요」라고 하면
   * 다음 문제가 나올 것처럼 들립니다.
   */
  holdLabel?: string;
}

export function NextButton({
  hold,
  onClick,
  children,
  className = 'btn btn-primary btn-lg mt-3',
  holdLabel = '정답을 보고 넘어가요',
}: NextButtonProps) {
  const [left, setLeft] = useState(() => (hold ? HOLD_MS : 0));

  useEffect(() => {
    if (!hold) {
      setLeft(0);
      return;
    }
    setLeft(HOLD_MS);

    // 남은 시간은 흐른 시간으로 계산합니다.
    // 타이머 간격을 빼 나가면 화면이 멈췄던 만큼(탭 전환 등) 어긋납니다.
    const started = Date.now();
    const id = window.setInterval(() => {
      const remain = HOLD_MS - (Date.now() - started);
      setLeft(remain > 0 ? remain : 0);
      if (remain <= 0) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [hold]);

  const locked = left > 0;
  const seconds = Math.ceil(left / 1000);

  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={className}
    >
      {locked ? `${holdLabel} · ${seconds}` : children}
    </button>
  );
}
