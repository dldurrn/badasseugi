'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * 오답노트 항목 지우기. 보호자 화면에서만 보입니다.
 *
 * 아이가 모은 별이 함께 사라지므로 한 번 더 묻습니다.
 * 창을 띄우는 대신 그 자리에서 물어보는 것은, 목록의 어느 항목을 지우는지
 * 눈에서 떼지 않게 하기 위해서입니다.
 */
export function NoteDeleteButton({ id, content }: { id: string; content: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setError('지우지 못했어요.');
      setBusy(false);
      return;
    }
    router.refresh();
  };

  if (!asking) {
    return (
      <button
        onClick={() => setAsking(true)}
        className="shrink-0 px-1 text-xs"
        style={{ color: 'var(--ink-faint)' }}
        aria-label={`오답노트에서 "${content}" 지우기`}
      >
        지우기
      </button>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs">
      {error ? (
        <span style={{ color: 'var(--pen-deep)' }}>{error}</span>
      ) : (
        /*
          「지웠으니 없어졌겠지」와 실제가 어긋나면 안 됩니다.
          노트는 「할 일」이고 리포트 기록은 「일어난 일」이라 서로 다릅니다 —
          목록을 정리했다고 과거가 사라지면 리포트가 정리 습관에 따라 달라집니다.
        */
        <span style={{ color: 'var(--ink-soft)' }}>별은 사라지고, 리포트 기록은 남아요</span>
      )}
      <button onClick={() => setAsking(false)} className="px-1" style={{ color: 'var(--ink-soft)' }}>
        취소
      </button>
      <button
        onClick={remove}
        disabled={busy}
        className="px-1 font-bold"
        style={{ color: 'var(--pen)' }}
      >
        지우기
      </button>
    </span>
  );
}
