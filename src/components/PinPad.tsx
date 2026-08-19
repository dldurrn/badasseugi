'use client';

import { useEffect } from 'react';
import { PIN_LENGTH } from '@/lib/profile';

/**
 * 숫자 4자리 입력판.
 *
 * 아이가 쓰는 화면이라 글자 키보드를 띄우지 않고 큰 숫자 버튼으로 받습니다.
 * (모바일에서 키보드가 올라오면 입력칸이 가려지는 문제도 함께 피합니다.)
 * 물리 키보드도 그대로 쓸 수 있게 숫자·지우기 키를 함께 듣습니다.
 */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

interface PinPadProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** 점 아래에 붙는 안내. 오답 안내는 빨간펜 색으로 넘겨 주세요. */
  hint?: React.ReactNode;
  autoFocusKeyboard?: boolean;
}

export function PinPad({
  value,
  onChange,
  disabled = false,
  hint,
  autoFocusKeyboard = true,
}: PinPadProps) {
  useEffect(() => {
    if (!autoFocusKeyboard || disabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^\d$/.test(event.key)) {
        if (value.length < PIN_LENGTH) onChange(value + event.key);
        event.preventDefault();
      } else if (event.key === 'Backspace') {
        onChange(value.slice(0, -1));
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [value, onChange, disabled, autoFocusKeyboard]);

  const press = (digit: string) => {
    if (disabled || value.length >= PIN_LENGTH) return;
    onChange(value + digit);
  };

  return (
    <div>
      <div
        className="mb-1 flex justify-center gap-3"
        role="status"
        aria-label={`비밀번호 ${value.length}자리 입력함`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded-full transition-colors"
            style={{
              background: i < value.length ? 'var(--grid)' : 'transparent',
              border: `1.5px solid ${i < value.length ? 'var(--grid)' : 'var(--rule-strong)'}`,
            }}
          />
        ))}
      </div>

      <div className="mb-4 min-h-[22px] text-center text-[13px]">{hint}</div>

      <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-2.5">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            disabled={disabled}
            className="surface display py-3.5 text-xl font-bold"
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => !disabled && onChange('')}
          disabled={disabled || value.length === 0}
          className="btn btn-quiet text-sm"
        >
          모두 지우기
        </button>
        <button
          type="button"
          onClick={() => press('0')}
          disabled={disabled}
          className="surface display py-3.5 text-xl font-bold"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => !disabled && onChange(value.slice(0, -1))}
          disabled={disabled || value.length === 0}
          className="btn btn-quiet text-sm"
          aria-label="한 자리 지우기"
        >
          지우기
        </button>
      </div>
    </div>
  );
}
