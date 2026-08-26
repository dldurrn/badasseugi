'use client';

import { useEffect, useState } from 'react';
import { forgetFallback, readFallback, type FallbackNote } from '@/lib/tts-app';

/**
 * 소리가 어디서 나오고 있는지 부모에게 알립니다. **보호자 화면에만 둡니다.**
 *
 * 서버 음성이 안 되면 앱은 브라우저 내장 음성으로 조용히 넘어갑니다.
 * 아이 화면에 "음성 오류"를 띄우지 않는 건 맞는 선택입니다 —
 * 문제 풀다 오류를 보면 거기서 멈추니까요.
 *
 * 그런데 그 조용함 때문에 **며칠째 내장 음성으로 읽고 있어도 아무도 몰랐습니다.**
 * 실제로 "발음이 이상하다"는 말이 나왔을 때, 목소리를 넷 눌러 보고서야
 * 서버 음성이 쓰이는지 아닌지를 갈랐습니다. 그 방법을 모르면 원인을 짚을 수가 없습니다.
 *
 * 그래서 넘어간 사실만 기기에 적어 두고 여기서 보여 줍니다.
 * 다음에 서버 음성이 되면 저절로 사라집니다.
 */

const MESSAGE: Record<FallbackNote['reason'], { title: string; body: string }> = {
  'not-configured': {
    title: '기기에 들어 있는 목소리로 읽고 있어요',
    body: '음성 서비스가 연결되지 않았어요. 위에서 목소리를 골라도 소리가 달라지지 않습니다.',
  },
  'daily-limit': {
    title: '오늘 몫을 다 써서 기기 목소리로 읽고 있어요',
    body: '내일이 되면 원래 목소리로 돌아옵니다. 미리듣기를 많이 누르면 아이 몫이 줄어들어요.',
  },
  /*
    막힌 것은 기다리거나 다시 눌러서 풀리지 않습니다.
    「잠깐 끊긴 것 같다」고 안내하면 부모가 며칠을 눌러 보다 앱을 의심하게 됩니다.
    할 수 있는 일을 그대로 적어 줍니다.
  */
  blocked: {
    title: '음성 서비스가 사용을 막았어요',
    body: '무료 한도를 넘겨 쓴 것 같아요. 기다린다고 풀리지는 않으니, 요금제를 올리거나 다른 음성 서비스로 바꿔야 해요.',
  },
  failed: {
    title: '음성 서비스가 응답하지 않아 기기 목소리로 읽었어요',
    body: '잠깐 끊긴 것일 수 있어요. 위에서 목소리를 한 번 들어 보고 소리가 달라지면 괜찮아진 것입니다.',
  },
};

/** 며칠 전인지 사람이 읽는 말로 */
function whenText(at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

export function TtsStatus() {
  // 서버에서 그릴 때는 localStorage를 읽을 수 없어, 뜬 뒤에 판단합니다.
  const [note, setNote] = useState<FallbackNote | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setNote(readFallback());
    setReady(true);
  }, []);

  // 잘 나오고 있으면 아무것도 띄우지 않습니다. 없는 문제를 만들지 않습니다.
  if (!ready || !note) return null;

  const { title, body } = MESSAGE[note.reason];

  return (
    <div
      className="mb-6 rounded-sm p-4"
      style={{ background: 'var(--pen-tint)', border: '1px solid var(--pen)' }}
      role="status"
    >
      <p className="text-[14px] font-bold" style={{ color: 'var(--pen-deep)' }}>
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {whenText(note.at)}에 그랬어요. {body}
      </p>
      <button
        className="btn btn-quiet mt-2 text-xs"
        onClick={() => {
          // 표시만 지웁니다. 다음에 또 넘어가면 다시 뜹니다.
          forgetFallback();
          setNote(null);
        }}
      >
        알겠어요
      </button>
    </div>
  );
}
