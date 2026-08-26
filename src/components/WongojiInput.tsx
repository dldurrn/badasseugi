'use client';

import type { RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  cellByRow,
  cellToTextOffset,
  eraseCell,
  growingGrid,
  rowEnd,
  rowStart,
  toWritingCells,
  writingCursor,
} from '@/lib/wongoji';
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
 *
 * 같은 이유로 **키보드의 ↑↓와 지우개도 손봐야 합니다.**
 * 한 줄짜리 입력칸에게 ↑↓는 「맨 앞/맨 끝」이라 원고지에서는 줄이 훌쩍 건너뜁니다.
 * 지우개는 더 어긋납니다 — 종이 원고지에서 칸을 짚고 지우면 **그 칸**이 지워지는데,
 * 입력칸의 백스페이스는 언제나 **앞 칸**을 지웁니다.
 * 「학꾜에」에서 「꾜」를 고치려고 그 칸을 짚고 지우면 「학」이 사라지는 셈입니다.
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
  /** 지금 이 원고지에 쓰고 있는가. 커서 칸을 진하게 짚을지 가릅니다. */
  const [focused, setFocused] = useState(false);
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

  /** 커서를 몇 번째 칸으로 옮깁니다. 글자 끝을 넘으면 끝에 멈춥니다. */
  const moveTo = useCallback(
    (cell: number) => {
      const el = inputRef.current;
      if (!el) return;
      const off = cellToTextOffset(el.value, Math.max(cell, 0));
      el.setSelectionRange(off, off);
      syncCaret();
    },
    [inputRef, syncCaret],
  );

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
        active={focused}
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
        onFocus={() => {
          setFocused(true);
          syncCaret();
        }}
        onBlur={() => setFocused(false)}
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
          if (e.key === 'Enter') {
            if (!composing) onEnter();
            return;
          }

          /*
            **조합 중에는 아무 키도 가로채지 않습니다.**
            조합 중 백스페이스는 「각 → 가 → ㄱ」처럼 자모를 하나씩 떼는
            한글 고유의 동작입니다. 이걸 뺏으면 쓰다가 한 글자를 통째로 잃습니다.
            `composing` 상태는 한 박자 늦을 수 있어 브라우저가 알려 주는 값도 함께 봅니다.
          */
          if (composing || e.nativeEvent.isComposing) return;

          const total = cells.length;

          // ↑↓ — 한 줄짜리 입력칸에게는 「맨 앞/맨 끝」이지만 원고지에서는 윗줄·아랫줄입니다.
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            moveTo(cellByRow(caret, e.key === 'ArrowUp' ? -1 : 1, total));
            return;
          }

          // Home/End — 줄 끝까지가 아니라 **그 줄의** 처음과 끝입니다.
          if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            moveTo(e.key === 'Home' ? rowStart(caret) : rowEnd(caret, total));
            return;
          }

          /*
            지우개 — 짚은 칸을 지웁니다.

            종이 원고지에서는 칸을 짚고 지우면 **그 칸**이 지워집니다.
            그런데 입력칸의 백스페이스는 언제나 앞 칸을 지웁니다.
            「학꾜에」의 「꾜」를 고치려고 그 칸을 짚고 지우면 「학」이 사라지는 셈입니다.

            글자가 든 칸을 짚고 있을 때만 바꿔치기합니다.
            끝에서 이어 쓰는 중이라면(짚은 칸이 빈 칸) 방금 쓴 글자를 무르는 게 맞으므로
            원래 동작 그대로 둡니다. 글자를 고를 때는 브라우저에 맡깁니다.
          */
          if (e.key === 'Backspace' && caret < total) {
            const el = inputRef.current;
            if (el && el.selectionStart === el.selectionEnd) {
              e.preventDefault();
              onChange(eraseCell(el.value, caret));
              // 커서는 짚은 칸에 그대로 둡니다. 뒤 글자가 그 칸으로 밀려 들어오므로
              // 한 번 더 누르면 이어서 지워집니다.
              window.setTimeout(() => moveTo(caret), 0);
            }
          }
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
