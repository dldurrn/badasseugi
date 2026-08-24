'use client';

import type { RefObject } from 'react';
import { useState } from 'react';
import { growingGrid, toCells, writingCursor } from '@/lib/wongoji';
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

  const cells = toCells(value);
  const grid = growingGrid(cells);

  const cursor = Math.min(writingCursor(cells.length, composing), grid.length - 1);
  const composingAt = composing && cells.length > 0 ? cursor : undefined;

  return (
    <div className="wg-input-wrap">
      <WongojiSheet cells={grid} cursor={cursor} composingAt={composingAt} label="답을 쓰는 원고지" />
      <input
        id="answer"
        ref={inputRef}
        className="wg-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
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
