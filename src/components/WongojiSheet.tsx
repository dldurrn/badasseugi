'use client';

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
  /** 칸을 눌러 그 자리로 옮길 수 있게 합니다 */
  onCellClick?: (index: number) => void;
  /** 미리보기에서 문장부호를 빨간펜 색으로 짚어 줍니다 */
  markPunct?: boolean;
  label?: string;
}

const PUNCT = new Set([',', '.', '?', '!', '…', '"', "'", ':', ';']);

export function WongojiSheet({
  cells,
  cursor,
  composingAt,
  onCellClick,
  markPunct = false,
  label,
}: WongojiSheetProps) {
  return (
    <div
      className="wg"
      style={{ ['--wg-cols' as string]: WONGOJI_COLS }}
      role="group"
      aria-label={label ?? '원고지'}
    >
      {cells.map((ch, i) => {
        const classes = ['wg-cell'];
        if (i === cursor) classes.push('wg-cell--cursor');
        if (i === composingAt) classes.push('wg-cell--ime');
        if (markPunct && PUNCT.has(ch)) classes.push('wg-cell--punct');

        // 칸을 누를 수 있을 때만 버튼으로 그립니다.
        // 미리보기까지 버튼이 되면 키보드 탭이 수십 번 걸립니다.
        if (onCellClick) {
          return (
            <button
              key={i}
              type="button"
              className={classes.join(' ')}
              onClick={() => onCellClick(i)}
              // 격자 전체가 아니라 지금 자리만 읽어 주면 됩니다.
              aria-label={`${i + 1}번째 칸${ch ? ` ${ch}` : ' 비어 있음'}`}
              tabIndex={-1}
            >
              {ch}
            </button>
          );
        }

        return (
          <span key={i} className={classes.join(' ')} aria-hidden="true">
            {ch}
          </span>
        );
      })}
    </div>
  );
}
