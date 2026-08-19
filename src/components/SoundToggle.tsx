'use client';

import { useEffect, useState } from 'react';
import { initSfx, isMuted, setMuted, sfx } from '@/lib/sfx';

/** 효과음 켜고 끄기. 켤 때 한 번 들려주어 어떤 소리인지 바로 알 수 있게 합니다. */
export function SoundToggle() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    initSfx();
    setMutedState(isMuted());
  }, []);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) sfx.tick();
  };

  return (
    <div className="surface flex items-center gap-4 p-4">
      <div className="flex-1">
        <p className="text-[15px] font-semibold">효과음</p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--ink-soft)' }}>
          정답과 오답을 소리로 알려줘요
        </p>
      </div>
      <button
        onClick={toggle}
        role="switch"
        aria-checked={!muted}
        aria-label="효과음"
        className="relative h-7 w-12 rounded-full transition-colors"
        style={{ background: muted ? 'var(--rule-strong)' : 'var(--grid)' }}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: muted ? 4 : 24 }}
        />
      </button>
    </div>
  );
}
