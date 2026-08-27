'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PinPad } from '@/components/PinPad';
import { AVATARS, DEFAULT_AVATAR } from '@/lib/avatars';
import { NICKNAME_MAX, PIN_LENGTH } from '@/lib/profile';
import type { ChildProfile } from '@/lib/types';

/**
 * 자녀 프로필 만들기·고치기.
 *
 * 받는 것은 별명과 그림뿐입니다. 실명·생일·사진은 아예 입력란을 두지 않습니다(지침 7).
 * 비밀번호는 형제자매가 남의 기록을 건드리지 않게 하는 잠금이라 선택 사항입니다.
 */

type PinMode = 'keep' | 'set' | 'remove';

export function ChildForm({ initial }: { initial?: ChildProfile }) {
  const router = useRouter();
  const editing = Boolean(initial);

  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? DEFAULT_AVATAR);
  const [pinMode, setPinMode] = useState<PinMode>('keep');
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pinReady =
    pinMode !== 'set' || (pin.length === PIN_LENGTH && pinAgain === pin);
  const canSave = nickname.trim().length > 0 && pinReady && !busy;

  const startSettingPin = () => {
    setPinMode('set');
    setPin('');
    setPinAgain('');
    setError(null);
  };

  const cancelPinChange = () => {
    setPinMode('keep');
    setPin('');
    setPinAgain('');
  };

  const save = async () => {
    setBusy(true);
    setError(null);

    if (pinMode === 'set' && pin !== pinAgain) {
      setError('두 번 누른 비밀번호가 서로 달라요. 다시 눌러 주세요.');
      setBusy(false);
      return;
    }

    const body: Record<string, unknown> = { nickname: nickname.trim(), avatar };
    if (pinMode === 'set') body.pin = pin;
    if (pinMode === 'remove') body.pin = null;

    const response = await fetch(
      editing ? `/api/children/${initial!.id}` : '/api/children',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
      return;
    }

    router.replace('/children');
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/children/${initial!.id}`, { method: 'DELETE' });
    if (!response.ok) {
      setError('지우지 못했어요. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
      return;
    }
    // 선택되어 있던 프로필이면 쿠키도 함께 지워졌으므로 전체 새로고침으로 나갑니다.
    window.location.replace('/children');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) save();
      }}
    >
      <label className="section-title mb-2 block" htmlFor="nickname">
        별명
      </label>
      <input
        id="nickname"
        className="field"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="예: 콩이"
        maxLength={NICKNAME_MAX}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        required
      />
      <p className="mb-6 mt-2 text-xs leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
        실제 이름 대신 집에서 부르는 별명을 적어 주세요.
      </p>

      <h2 className="section-title mb-2">그림</h2>
      <div
        className="mb-6 grid grid-cols-6 gap-2"
        role="radiogroup"
        aria-label="프로필 그림"
      >
        {AVATARS.map((item) => {
          const active = item === avatar;
          return (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`그림 ${item}`}
              onClick={() => setAvatar(item)}
              className="flex items-center justify-center rounded-[var(--radius-sm)] py-2.5 text-2xl"
              style={{
                background: active ? 'var(--grid-tint)' : 'var(--card)',
                border: `${active ? 2 : 1}px solid ${active ? 'var(--grid)' : 'var(--rule)'}`,
              }}
            >
              <span aria-hidden="true">{item}</span>
            </button>
          );
        })}
      </div>

      <h2 className="section-title mb-2">비밀번호</h2>
      <div className="surface mb-6 p-4">
        {pinMode === 'set' ? (
          <div className="rise-in">
            <p className="mb-3 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
              {pin.length < PIN_LENGTH
                ? '새 비밀번호 네 자리를 눌러 주세요'
                : '한 번 더 눌러서 확인해요'}
            </p>
            {pin.length < PIN_LENGTH ? (
              <PinPad value={pin} onChange={setPin} />
            ) : (
              <PinPad
                value={pinAgain}
                onChange={setPinAgain}
                hint={
                  pinAgain.length === PIN_LENGTH && pinAgain !== pin ? (
                    <span style={{ color: 'var(--pen-deep)' }}>앞에서 누른 것과 달라요</span>
                  ) : null
                }
              />
            )}
            <div className="mt-3 flex justify-center gap-2">
              {pin.length === PIN_LENGTH && (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    setPin('');
                    setPinAgain('');
                  }}
                >
                  처음부터 다시
                </button>
              )}
              <button type="button" className="btn btn-quiet" onClick={cancelPinChange}>
                그만두기
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
              {pinMode === 'remove'
                ? '저장하면 비밀번호 없이 들어갈 수 있어요.'
                : initial?.hasPin
                  ? '이 프로필은 비밀번호로 잠겨 있어요.'
                  : '동생이나 형이 잘못 들어가지 않게 잠글 수 있어요.'}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={startSettingPin}>
                {initial?.hasPin && pinMode !== 'remove' ? '바꾸기' : '만들기'}
              </button>
              {initial?.hasPin && pinMode === 'keep' && (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setPinMode('remove')}
                >
                  없애기
                </button>
              )}
              {pinMode === 'remove' && (
                <button type="button" className="btn btn-quiet" onClick={cancelPinChange}>
                  되돌리기
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p
          className="mb-4 rounded-sm p-3 text-center text-sm"
          style={{ background: 'var(--pen-tint)', color: 'var(--pen-deep)' }}
          role="status"
        >
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-lg" disabled={!canSave}>
        {editing ? '저장하기' : '프로필 만들기'}
      </button>

      {editing && (
        <div className="mt-8 border-t pt-5" style={{ borderColor: 'var(--rule)' }}>
          {confirmingDelete ? (
            <div className="rise-in text-center">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--pen-deep)' }}>
                {initial!.nickname}의 점수·오답노트·모은 카드가 모두 함께 지워져요.
                <br />
                되돌릴 수 없어요. 정말 지울까요?
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmingDelete(false)}
                >
                  그만두기
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'var(--pen)', color: '#fff' }}
                  onClick={remove}
                  disabled={busy}
                >
                  지우기
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-quiet w-full justify-center"
              style={{ color: 'var(--pen)' }}
              onClick={() => setConfirmingDelete(true)}
            >
              이 프로필 지우기
            </button>
          )}
        </div>
      )}
    </form>
  );
}
