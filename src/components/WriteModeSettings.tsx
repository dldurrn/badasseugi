'use client';

import { useEffect, useState } from 'react';
import { padToGrid, toCells } from '@/lib/wongoji';
import { readWriteMode, saveWriteMode, type WriteMode } from '@/lib/write-mode';
import { WongojiSheet } from './WongojiSheet';

/**
 * 받아쓰기를 원고지에 쓸지 한 줄에 쓸지 고릅니다.
 *
 * 글로만 설명하면 무엇이 달라지는지 모릅니다. 고른 모습을 그대로 보여 줍니다.
 * 기기별로 저장하는 것은 속도·목소리와 같습니다.
 */

const SAMPLE = '눈처럼 하얗고 예쁜 집이';

export function WriteModeSettings() {
  const [mode, setMode] = useState<WriteMode>('wongoji');

  useEffect(() => setMode(readWriteMode()), []);

  const choose = (next: WriteMode) => {
    setMode(next);
    saveWriteMode(next);
  };

  return (
    <>
      <h2 className="section-title mb-2">받아쓰기 쓰는 방법</h2>
      <div className="surface mb-6 p-4">
        <div className="mb-3 flex gap-2">
          {(
            [
              { value: 'wongoji', label: '원고지에 쓰기' },
              { value: 'plain', label: '그냥 쓰기' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => choose(option.value)}
              aria-pressed={mode === option.value}
              className="flex-1 rounded-sm px-3 py-2 text-sm transition-colors"
              style={{
                background: mode === option.value ? 'var(--grid)' : 'var(--paper-sunk)',
                color: mode === option.value ? '#fff' : 'var(--ink-soft)',
                fontWeight: mode === option.value ? 700 : 500,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mode === 'wongoji' ? (
          <>
            <WongojiSheet cells={padToGrid(toCells(SAMPLE), 2)} label="원고지 보기" />
            <p className="mt-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
              학교 공책처럼 칸마다 한 글자씩 써요. 띄어쓰기도 한 칸이에요.
            </p>
          </>
        ) : (
          <>
            <p
              className="field-answer rounded-sm px-3 py-3"
              style={{ background: 'var(--paper-sunk)', letterSpacing: '0.04em' }}
            >
              {SAMPLE}
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
              한 줄에 이어서 써요.
            </p>
          </>
        )}

        <p className="mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
          받아쓰기 화면에서도 바로 바꿀 수 있어요.
        </p>
      </div>
    </>
  );
}
