'use client';

import { useEffect, useState } from 'react';
import { RATE_LABEL, SpeechController, type SpeechRate } from '@/lib/tts';
import { appSpeech, DEFAULT_RATE, RATES, readRate, writeRate } from '@/lib/tts-app';

/**
 * 읽기 속도의 기본값.
 *
 * 세션 화면에도 같은 버튼이 있습니다. 이건 옮긴 게 아니라 둘 다 두는 것입니다.
 * - 세션 화면: 문제를 풀다 "못 들었어, 천천히" 할 때. 그 자리에서 바꿔야 합니다.
 * - 설정 화면: 우리 아이는 늘 천천히 들어야 한다고 미리 정해 둘 때.
 *
 * 어느 쪽에서 바꾸든 같은 값을 쓰기 때문에 다음 세션에도 그대로 이어집니다.
 */

const SAMPLE = '나는 학교에 갔어요.';

export function RateSettings() {
  const [rate, setRate] = useState<SpeechRate>(DEFAULT_RATE);
  const [playing, setPlaying] = useState(false);

  // 서버에서 그릴 때는 localStorage를 읽을 수 없어, 뜬 뒤에 불러옵니다.
  useEffect(() => setRate(readRate()), []);

  const choose = async (next: SpeechRate) => {
    setRate(next);
    writeRate(next);

    // 고르자마자 들려줍니다. 숫자보다 귀로 확인하는 편이 빠릅니다.
    setPlaying(true);
    const speech = new SpeechController(appSpeech);
    await speech.play(SAMPLE, next, 'flow');
    setPlaying(false);
  };

  return (
    <>
      <h2 className="section-title mb-2">읽는 속도</h2>
      <div className="surface mb-6 p-4">
        <div className="flex gap-2" role="group" aria-label="읽는 속도">
          {RATES.map((r) => {
            const on = r === rate;
            return (
              <button
                key={r}
                onClick={() => choose(r)}
                aria-pressed={on}
                className="btn flex-1 justify-center"
                style={{
                  background: on ? 'var(--grid)' : 'var(--card)',
                  color: on ? '#fff' : 'var(--ink)',
                  border: `1px solid ${on ? 'var(--grid)' : 'var(--rule-strong)'}`,
                  fontSize: 14,
                  padding: '12px 8px',
                }}
              >
                {RATE_LABEL[r]}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {playing
            ? '들려주는 중이에요…'
            : '여기서 정한 속도로 시작해요. 문제를 푸는 중에도 바꿀 수 있어요.'}
        </p>
      </div>
    </>
  );
}
