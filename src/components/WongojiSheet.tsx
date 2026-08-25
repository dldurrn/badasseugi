'use client';

import type { RefObject } from 'react';
import { WONGOJI_COLS } from '@/lib/wongoji';

/**
 * 원고지 격자.
 *
 * 세트 만들기의 미리보기와 아이가 쓰는 화면이 **같은 부품**을 씁니다.
 * 부모가 미리보기에서 확인한 모양이 곧 아이가 보는 모양이어야
 * "화면에서는 이렇게 보였는데" 하는 어긋남이 생기지 않습니다.
 */

interface WongojiSheetProps {
  /** 칸마다 글자 하나. 빈 문자열은 빈 칸입니다. */
  cells: string[];
  /** 지금 쓸 자리. 없으면 커서를 그리지 않습니다(미리보기). */
  cursor?: number;
  /** 조합 중이라 아직 확정되지 않은 칸 */
  composingAt?: number;
  /**
   * 격자 DOM. 누른 자리가 몇 번째 칸인지 재려면 칸들의 좌표가 필요합니다.
   * 쓰기 화면에서만 씁니다.
   */
  gridRef?: RefObject<HTMLDivElement | null>;
  /** 미리보기에서 문장부호를 빨간펜 색으로 짚어 줍니다 */
  markPunct?: boolean;
  label?: string;
}

const PUNCT = new Set([',', '.', '?', '!', '…', '"', "'", ':', ';']);

export function WongojiSheet({
  cells,
  cursor,
  composingAt,
  gridRef,
  markPunct = false,
  label,
}: WongojiSheetProps) {
  return (
    <div
      ref={gridRef}
      className="wg"
      style={{ ['--wg-cols' as string]: WONGOJI_COLS }}
      role="group"
      aria-label={label ?? '원고지'}
    >
      {/*
        칸은 버튼이 아니라 그림입니다.
        누르는 것은 격자 위에 덮인 입력칸이 받고, 거기서 몇 번째 칸인지 되짚습니다.
        칸마다 버튼을 두면 탭 키가 마흔 번 걸리고, 폰에서는 키보드가 안 올라옵니다.
      */}
      {cells.map((ch, i) => {
        const classes = ['wg-cell'];
        if (i === cursor) classes.push('wg-cell--cursor');
        if (i === composingAt) classes.push('wg-cell--ime');
        if (markPunct && PUNCT.has(ch)) classes.push('wg-cell--punct');

        return (
          <span key={i} className={classes.join(' ')} aria-hidden="true">
            {ch}
          </span>
        );
      })}
    </div>
  );
}
