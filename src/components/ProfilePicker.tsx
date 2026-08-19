'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PinPad } from '@/components/PinPad';
import { EmptyState } from '@/components/EmptyState';
import { MAX_CHILDREN, PIN_LENGTH } from '@/lib/profile';
import type { ChildProfile } from '@/lib/types';

/**
 * 누가 쓰는지 고르는 화면.
 *
 * 여기서 고른 값이 화면 구성을 나눕니다.
 *  - 자녀를 고르면 자녀 화면(세트 만들기·리포트는 보이지 않음)
 *  - 보호자를 고르면 보호자 화면
 *
 * 들어간 뒤에는 전체 새로고침으로 옮깁니다.
 * 쿠키가 방금 바뀌었으니 서버가 다시 그리게 두는 편이 확실합니다.
 */
export function ProfilePicker({
  profiles,
  parentLocked,
}: {
  profiles: ChildProfile[];
  /** 보호자 잠금이 걸려 있는지. 걸려 있으면 전환할 때 PIN을 묻습니다. */
  parentLocked: boolean;
}) {
  const [locked, setLocked] = useState<ChildProfile | null>(null);
  const [askingParent, setAskingParent] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enter = useCallback(async (child: ChildProfile, code: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/children/${child.id}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? '들어가지 못했어요. 다시 눌러 주세요.');
        setPin('');
        setBusy(false);
        return;
      }
      window.location.replace('/');
    } catch {
      setError('연결이 끊겼어요. 잠시 후 다시 눌러 주세요.');
      setPin('');
      setBusy(false);
    }
  }, []);

  const goParent = useCallback(async (code?: string) => {
    setBusy(true);
    setError(null);
    const response = await fetch('/api/profile/parent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: code ?? '' }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; locked?: boolean }
        | null;
      // 30분 유예가 끝났을 수 있으므로 잠금 응답이면 입력판을 띄웁니다.
      if (payload?.locked) setAskingParent(true);
      setError(payload?.error ?? '보호자 화면으로 넘어가지 못했어요. 다시 눌러 주세요.');
      setPin('');
      setBusy(false);
      return;
    }
    window.location.replace('/');
  }, []);

  // 네 자리가 채워지면 따로 누르지 않아도 들어갑니다. 아이가 확인 버튼을 못 찾는 일을 줄입니다.
  useEffect(() => {
    if (busy || pin.length !== PIN_LENGTH) return;
    if (locked) enter(locked, pin);
    else if (askingParent) goParent(pin);
  }, [locked, askingParent, pin, busy, enter, goParent]);

  if (askingParent) {
    return (
      <section className="rise-in">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2 text-[56px] leading-none" aria-hidden="true">
            🔒
          </div>
          <p className="display text-lg font-bold">보호자 확인</p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            보호자 화면에는 정답 문장이 보여요.
            <br />
            비밀번호 네 자리를 눌러 주세요.
          </p>
        </div>

        <PinPad
          value={pin}
          onChange={setPin}
          disabled={busy}
          hint={
            error ? (
              <span style={{ color: 'var(--pen-deep)' }}>{error}</span>
            ) : (
              <span style={{ color: 'var(--ink-faint)' }}>한 번 확인하면 30분 동안은 안 물어봐요</span>
            )
          }
        />

        <button
          className="btn btn-quiet mx-auto mt-5 block"
          onClick={() => {
            setAskingParent(false);
            setPin('');
            setError(null);
          }}
        >
          그만두기
        </button>
      </section>
    );
  }

  if (locked) {
    return (
      <section className="rise-in">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2 text-[56px] leading-none" aria-hidden="true">
            {locked.avatar}
          </div>
          <p className="display text-lg font-bold">{locked.nickname}</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            비밀번호 네 자리를 눌러 주세요
          </p>
        </div>

        <PinPad
          value={pin}
          onChange={setPin}
          disabled={busy}
          hint={
            error ? (
              <span style={{ color: 'var(--pen-deep)' }}>{error}</span>
            ) : (
              <span style={{ color: 'var(--ink-faint)' }}>숫자만 눌러요</span>
            )
          }
        />

        <button
          className="btn btn-quiet mx-auto mt-5 block"
          onClick={() => {
            setLocked(null);
            setPin('');
            setError(null);
          }}
        >
          다른 프로필 고르기
        </button>
      </section>
    );
  }

  return (
    <section>
      {profiles.length === 0 ? (
        <EmptyState
          title="아직 프로필이 없어요"
          description="아이 별명으로 프로필을 하나 만들면, 그때부터 기록이 아이별로 쌓여요."
          action={
            <Link href="/children/new" className="btn btn-primary">
              프로필 만들기
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {profiles.map((child) => (
            <li key={child.id}>
              <button
                onClick={() => (child.hasPin ? setLocked(child) : enter(child, ''))}
                disabled={busy}
                className="surface flex w-full flex-col items-center gap-1.5 px-3 py-6"
              >
                <span className="text-[44px] leading-none" aria-hidden="true">
                  {child.avatar}
                </span>
                <span className="display text-base font-bold">{child.nickname}</span>
                {child.hasPin && (
                  <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                    🔒 비밀번호 있어요
                  </span>
                )}
              </button>
            </li>
          ))}
          {profiles.length < MAX_CHILDREN && (
            <li>
              <Link
                href="/children/new"
                className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-[var(--radius)] px-3 py-6"
                style={{ border: '1px dashed var(--rule-strong)', color: 'var(--ink-soft)' }}
              >
                <span className="text-[32px] leading-none" aria-hidden="true">
                  ＋
                </span>
                <span className="text-sm font-semibold">프로필 추가</span>
              </Link>
            </li>
          )}
        </ul>
      )}

      {error && !locked && (
        <p
          className="mt-4 rounded-sm p-3 text-center text-sm"
          style={{ background: 'var(--pen-tint)', color: 'var(--pen-deep)' }}
          role="status"
        >
          {error}
        </p>
      )}

      <div className="mt-8 border-t pt-5 text-center" style={{ borderColor: 'var(--rule)' }}>
        <button
          className="btn btn-secondary"
          onClick={() => (parentLocked ? setAskingParent(true) : goParent())}
          disabled={busy}
        >
          {parentLocked && <span aria-hidden="true">🔒</span>}
          보호자 화면으로 들어가기
        </button>
        <p className="mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
          문제 만들기와 리포트는 보호자 화면에 있어요
        </p>
      </div>
    </section>
  );
}
