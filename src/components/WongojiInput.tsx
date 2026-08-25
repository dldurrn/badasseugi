'use client';

import type { RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';
import { cellToTextOffset, growingGrid, toWritingCells, writingCursor } from '@/lib/wongoji';
import { WongojiSheet } from './WongojiSheet';

/**
 * 원고지에 쓰기.
 *
 * 격자는 **보여 주기만** 하고, 글자는 평범한 입력칸 하나가 받습니다.
 * 칸마다 입력칸을 따로 두는 방법도 있지만, 한글은 `ㅇ → 여 → 예`처럼
 * 조합되는 도중에 글자가 바뀌고 그 동작이 키보드 앱마다 달라서
 * 칸 경계에서 조합이 끊길 위험이 큽니다.
 * 입력칸 하나면 한글 조합이 원래 하던 대로 굴러가고,
 * 백스페이스·커서 이동·붙여넣기까지 공짜로 따라옵니다.
 *
 * 그 입력칸을 격자 위에 투명하게 덮어 둡니다.
 * 아이가 격자를 누르면 곧 입력칸을 누른 것이라 키보드가 그대로 올라옵니다 —
 * 코드로 포커스를 옮기면 기기에 따라 키보드가 안 뜨는 일이 있습니다.
 *
 * 다만 덮어 두기만 하면 **누른 칸과 글자가 들어가는 자리가 어긋납니다.**
 * 입력칸은 속으로 한 줄짜리라, 둘째 줄을 눌러도 첫째 줄 어딘가로 갑니다.
 * 그래서 누른 자리가 몇 번째 칸인지 되짚어 글자 위치를 다시 잡아 줍니다.
 */

interface WongojiInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  maxLength?: number;
}

export function WongojiInput({
  value,
  onChange,
  onEnter,
  inputRef,
  maxLength,
}: WongojiInputProps) {
  // 조합 중인 글자는 옅게 그려서, 아직 확정되지 않았다는 걸 보여 줍니다.
  const [composing, setComposing] = useState(false);
  /** 지금 글자가 들어갈 자리. 입력칸의 실제 커서를 따라갑니다. */
  const [caret, setCaret] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const cells = toWritingCells(value);
  const grid = growingGrid(cells);

  /** 입력칸이 실제로 어디를 가리키는지 읽어 옵니다. 화면이 거짓말하지 않도록. */
  const syncCaret = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? el.value.length;
    setCaret(Array.from(el.value.slice(0, pos)).length);
  }, [inputRef]);

  /** 누른 자리가 몇 번째 칸인지 되짚습니다. */
  const cellAt = (x: number, y: number): number | null => {
    const cellNodes = gridRef.current?.children;
    if (!cellNodes) return null;
    for (let i = 0; i < cellNodes.length; i += 1) {
      const r = cellNodes[i].getBoundingClientRect();
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return i;
    }
    return null;
  };

  const cursor = Math.min(writingCursor(caret, composing), grid.length - 1);
  const composingAt = composing && caret > 0 ? cursor : undefined;

  return (
    <div className="wg-input-wrap">
      <WongojiSheet
        cells={grid}
        cursor={cursor}
        composingAt={composingAt}
        gridRef={gridRef}
        label="답을 쓰는 원고지"
      />
      <input
        id="answer"
        ref={inputRef}
        className="wg-input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // 값이 바뀐 뒤의 커서를 읽어야 하므로 다음 차례로 미룹니다.
          window.setTimeout(syncCaret, 0);
        }}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => {
          setComposing(false);
          window.setTimeout(syncCaret, 0);
        }}
        onSelect={syncCaret}
        onKeyUp={syncCaret}
        onFocus={syncCaret}
        onClick={(e) => {
          // 브라우저가 먼저 제 나름대로 커서를 잡아 두므로, 그 뒤에 우리가 고쳐 잡습니다.
          const i = cellAt(e.clientX, e.clientY);
          if (i === null) return;
          const el = inputRef.current;
          if (!el) return;
          const off = cellToTextOffset(el.value, i);
          el.setSelectionRange(off, off);
          syncCaret();
        }}
        onKeyDown={(e) => {
          // 조합 중의 엔터는 글자를 확정하는 것이지 제출이 아닙니다.
          if (e.key === 'Enter' && !composing) onEnter();
        }}
        maxLength={maxLength}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label="들은 문장을 원고지에 써 보세요"
      />
    </div>
  );
}
