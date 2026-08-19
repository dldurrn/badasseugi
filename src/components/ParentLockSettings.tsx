'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PinPad } from '@/components/PinPad';
import { PIN_LENGTH } from '@/lib/profile';

/**
 * 보호자 잠금 만들기·바꾸기·없애기.
 *
 * 이 잠금이 막는 것은 리포트를 엿보는 게 아니라 **정답 문장 열람**입니다.
 * 보호자 화면에서는 세트를 열면 정답이 그대로 보이거든요.
 * 그 이유를 화면에 적어 둡니다. 이유를 모르면 부모가 그냥 꺼 버립니다.
 */
export function ParentLockSettings({ locked }: { locked: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEditing(false);
    setPin('');
    setAgain('');
    setError(null);
  };

  const save = async () => {
    if (pin !== again) {
      setError('두 번 누른 비밀번호가 서로 달라요.');
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch('/api/profile/parent-pin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? '저장하지 못했어요.');
      setBusy(false);
      return;
    }
    reset();
    setBusy(false);
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch('/api/profile/parent-pin', { method: 'DELETE' });
    if (!response.ok) {
      setError('없애지 못했어요.');
      setBusy(false);
      return;
    }
    setRemoving(false);
    setBusy(false);
    router.refresh();
  };

  if (editing) {
    return (
      <div className="surface rise-in p-4">
        <p className="mb-3 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          {pin.length < PIN_LENGTH ? '새 비밀번호 네 자리' : '한 번 더 눌러서 확인해요'}
        </p>
        {pin.length < PIN_LENGTH ? (
          <PinPad value={pin} onChange={setPin} disabled={busy} />
        ) : (
          <PinPad
            value={again}
            onChange={setAgain}
            disabled={busy}
            hint={
              error ? (
                <span style={{ color: 'var(--pen-deep)' }}>{error}</span>
              ) : null
            }
          />
        )}

        <div className="mt-3 flex justify-center gap-2">
          {pin.length === PIN_LENGTH && (
            <>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setPin('');
                  setAgain('');
                  setError(null);
                }}
              >
                처음부터 다시
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={save}
                disabled={busy || again.length !== PIN_LENGTH}
              >
                저장하기
              </button>
            </>
          )}
          <button type="button" className="btn btn-quiet" onClick={reset}>
            그만두기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="text-[15px] font-semibold">
            {locked ? '🔒 잠금이 걸려 있어요' : '잠금이 없어요'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {locked
              ? '아이 화면에서 보호자 화면으로 넘어올 때 비밀번호를 물어요. 한 번 확인하면 30분 동안은 묻지 않아요.'
              : '보호자 화면에서는 받아쓰기 정답 문장이 그대로 보여요. 잠그면 아이가 시험 전에 답을 보고 오는 것을 막을 수 있어요.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            {locked ? '바꾸기' : '잠금 만들기'}
          </button>
          {locked && !removing && (
            <button type="button" className="btn btn-quiet" onClick={() => setRemoving(true)}>
              없애기
            </button>
          )}
        </div>
      </div>

      {removing && (
        <div className="rise-in mt-3 border-t pt-3 text-center" style={{ borderColor: 'var(--rule)' }}>
          <p className="text-sm" style={{ color: 'var(--pen-deep)' }}>
            없애면 아이도 보호자 화면에 그냥 들어올 수 있어요. 없앨까요?
          </p>
          <div className="mt-2 flex justify-center gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setRemoving(false)}>
              그만두기
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: 'var(--pen)', color: '#fff' }}
              onClick={remove}
              disabled={busy}
            >
              없애기
            </button>
          </div>
        </div>
      )}

      {error && !editing && (
        <p className="mt-3 text-center text-sm" style={{ color: 'var(--pen-deep)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
