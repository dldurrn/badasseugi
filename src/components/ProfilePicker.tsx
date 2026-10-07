'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PinPad } from '@/components/PinPad';
import { EmptyState } from '@/components/EmptyState';
import { LOCK_LATER_KEY, shouldAskToSetLock } from '@/lib/parent-lock';
import { MAX_CHILDREN, PIN_LENGTH } from '@/lib/profile';
import { toDateKeyInSeoul } from '@/lib/review';
import { signOutAndGoToLogin } from '@/lib/sign-out';
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
  // 잠금이 없는 집이 처음 들어올 때 비밀번호를 정하는 단계. pin 이 첫 번, again 이 확인입니다.
  const [settingUp, setSettingUp] = useState(false);
  const [again, setAgain] = useState('');
  const [forgetting, setForgetting] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchAccount = async () => {
    setBusy(true);
    await signOutAndGoToLogin();
  };

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
      // 401 은 「아직 번호를 안 눌렀다」일 뿐이라 처음 입력판에 빨간 글씨를 띄우지 않습니다.
      if (response.status !== 401) {
        setError(payload?.error ?? '보호자 화면으로 넘어가지 못했어요. 다시 눌러 주세요.');
      }
      setPin('');
      setBusy(false);
      return;
    }
    window.location.replace('/');
  }, []);

  /**
   * 입구에서 비밀번호를 정하고 곧바로 들어갑니다. 설정까지 가는 걸음을 없애려고요.
   * 두 번 누른 것이 다르면 확인 쪽만 비웁니다 — 처음부터 다시 누르게 하면 번거롭습니다.
   */
  const saveLock = useCallback(
    async (first: string, second: string) => {
      if (first !== second) {
        setError('두 번 누른 비밀번호가 서로 달라요. 확인 번호를 다시 눌러 주세요.');
        setAgain('');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const response = await fetch('/api/profile/parent-pin', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: first }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? '저장하지 못했어요. 다시 눌러 주세요.');
          setAgain('');
          setBusy(false);
          return;
        }
      } catch {
        setError('연결이 끊겼어요. 잠시 후 다시 눌러 주세요.');
        setAgain('');
        setBusy(false);
        return;
      }
      await goParent();
    },
    [goParent],
  );

  /** 「나중에 할게요」 — 오늘 하루만 미룹니다. 내일 들어오면 다시 묻습니다. */
  const postponeLock = async () => {
    try {
      localStorage.setItem(LOCK_LATER_KEY, toDateKeyInSeoul());
    } catch {
      // 기기에 못 적어도 이번 한 번은 그냥 들어갑니다.
    }
    await goParent();
  };

  /**
   * 보호자 버튼.
   * 잠겨 있으면 **먼저 그냥 들어가 봅니다** — 30분 안에 한 번 확인했거나 방금 다시 로그인했으면
   * 입력판 없이 통과하기 때문입니다. 안 되면 서버가 「잠겼다」고 알려 주고 그때 입력판이 뜹니다.
   */
  const openParent = () => {
    if (parentLocked) {
      goParent();
      return;
    }
    let laterOn: string | null = null;
    try {
      laterOn = localStorage.getItem(LOCK_LATER_KEY);
    } catch {
      laterOn = null;
    }
    if (shouldAskToSetLock({ locked: false, laterOn, today: toDateKeyInSeoul() })) {
      setSettingUp(true);
      return;
    }
    goParent();
  };

  const forgotPin = async () => {
    setBusy(true);
    // 표시를 남기고 나갑니다. 다시 로그인하면 서버가 그 사실을 보고 한 번 통과시킵니다.
    await fetch('/api/profile/lock-reset', { method: 'POST' }).catch(() => null);
    await signOutAndGoToLogin();
  };

  // 네 자리가 채워지면 따로 누르지 않아도 들어갑니다. 아이가 확인 버튼을 못 찾는 일을 줄입니다.
  useEffect(() => {
    if (busy || pin.length !== PIN_LENGTH) return;
    if (locked) enter(locked, pin);
    else if (askingParent) goParent(pin);
  }, [locked, askingParent, pin, busy, enter, goParent]);

  useEffect(() => {
    if (busy || !settingUp) return;
    if (pin.length === PIN_LENGTH && again.length === PIN_LENGTH) saveLock(pin, again);
  }, [settingUp, pin, again, busy, saveLock]);

  if (settingUp) {
    const firstDone = pin.length === PIN_LENGTH;
    return (
      <section className="rise-in">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2 text-[56px] leading-none" aria-hidden="true">
            🔒
          </div>
          <p className="display text-lg font-bold">보호자 비밀번호 정하기</p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            보호자 화면에서는 아이 프로필, 보이는 문제, 기록을 바꿀 수 있어요.
            <br />
            보호자만 들어오도록 비밀번호를 정해 둘게요.
          </p>
          <p className="mt-2 text-sm font-semibold">
            {firstDone ? '한 번 더 눌러서 확인해요' : '새 비밀번호 네 자리'}
          </p>
        </div>

        {firstDone ? (
          <PinPad
            value={again}
            onChange={setAgain}
            disabled={busy}
            hint={
              error ? (
                <span style={{ color: 'var(--pen-deep)' }}>{error}</span>
              ) : (
                <span style={{ color: 'var(--ink-faint)' }}>아이가 모르는 숫자로 정해 주세요</span>
              )
            }
          />
        ) : (
          <PinPad
            value={pin}
            onChange={setPin}
            disabled={busy}
            hint={
              <span style={{ color: 'var(--ink-faint)' }}>
                잊어도 다시 로그인하면 새로 정할 수 있어요
              </span>
            }
          />
        )}

        <div className="mt-5 flex justify-center gap-2">
          {firstDone && (
            <button
              className="btn btn-quiet"
              disabled={busy}
              onClick={() => {
                setPin('');
                setAgain('');
                setError(null);
              }}
            >
              처음부터 다시
            </button>
          )}
          <button className="btn btn-quiet" disabled={busy} onClick={postponeLock}>
            나중에 할게요
          </button>
        </div>
        <p className="mt-1 text-center text-xs" style={{ color: 'var(--ink-faint)' }}>
          나중에 해도 내일 들어올 때 다시 물어봐요
        </p>
      </section>
    );
  }

  if (askingParent) {
    return (
      <section className="rise-in">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2 text-[56px] leading-none" aria-hidden="true">
            🔒
          </div>
          <p className="display text-lg font-bold">보호자 확인</p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            보호자 화면에서는 설정을 바꿀 수 있어요.
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
            setForgetting(false);
            setPin('');
            setError(null);
          }}
        >
          그만두기
        </button>

        {forgetting ? (
          <div className="rise-in mt-3 text-center">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              지금 계정에서 나갔다가 다시 로그인하면
              <br />
              새 비밀번호를 정할 수 있어요. 기록은 지워지지 않아요.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => setForgetting(false)}
                disabled={busy}
              >
                그만두기
              </button>
              <button className="btn btn-primary" onClick={forgotPin} disabled={busy}>
                다시 로그인하기
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-quiet mx-auto mt-1 block text-sm"
            style={{ color: 'var(--ink-soft)' }}
            onClick={() => setForgetting(true)}
            disabled={busy}
          >
            비밀번호를 잊었어요
          </button>
        )}
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
                /*
                  h-full 이 없으면 **비밀번호를 건 아이만 카드가 커집니다.**
                  「🔒 비밀번호 있어요」 한 줄 때문에 속 내용의 키가 달라지는데,
                  칸(li)은 늘어나도 그 안의 버튼은 제 키만큼만 차지하기 때문입니다.
                  나란히 놓인 얼굴의 크기가 다르면 하나가 잘못된 것처럼 보입니다.
                  「프로필 추가」 칸은 처음부터 h-full 이라 이것만 어긋나 있었습니다.
                */
                className="surface flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 py-6"
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
          onClick={openParent}
          disabled={busy}
        >
          {parentLocked && <span aria-hidden="true">🔒</span>}
          보호자 화면으로 들어가기
        </button>
        <p className="mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
          문제 만들기와 리포트는 보호자 화면에 있어요
        </p>
      </div>

      {/*
        계정을 갈아타려는 사람은 반드시 이 화면을 지납니다.
        설정 깊숙이 있는 로그아웃까지 가려면 다섯 걸음이라, 여기에 길을 하나 냅니다.
        아이는 여기서 자기 얼굴만 누르므로 실수로 눌릴 자리도 아닙니다.
      */}
      <div className="mt-5 text-center">
        {switchingAccount ? (
          <div className="rise-in">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              지금 계정에서 나가고 다른 계정으로 들어가요.
              <br />
              지금까지 쌓인 기록은 지워지지 않아요.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => setSwitchingAccount(false)}
                disabled={busy}
              >
                그만두기
              </button>
              <button
                className="btn"
                style={{ background: 'var(--pen)', color: '#fff' }}
                onClick={switchAccount}
                disabled={busy}
              >
                나가기
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-quiet text-sm"
            onClick={() => setSwitchingAccount(true)}
            disabled={busy}
            style={{ color: 'var(--ink-soft)' }}
          >
            다른 계정으로 로그인
          </button>
        )}
      </div>
    </section>
  );
}
