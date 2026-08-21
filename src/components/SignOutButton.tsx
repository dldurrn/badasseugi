'use client';

import { useState } from 'react';
import { signOutAndGoToLogin } from '@/lib/sign-out';

/**
 * 로그아웃.
 *
 * 한 번 더 묻습니다. 계정 비밀번호를 기억하지 못하는 상태에서 잘못 누르면
 * 메일 확인까지 거쳐야 돌아올 수 있습니다.
 */
export function SignOutButton() {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    await signOutAndGoToLogin();
  };

  if (!asking) {
    return (
      <button
        onClick={() => setAsking(true)}
        className="btn btn-quiet w-full justify-start"
        style={{ color: 'var(--pen)' }}
      >
        로그아웃
      </button>
    );
  }

  return (
    <div className="rise-in text-center">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        다시 들어오려면 이메일과 비밀번호가 필요해요.
        <br />
        기록은 지워지지 않아요.
      </p>
      <div className="mt-3 flex justify-center gap-2">
        <button className="btn btn-secondary" onClick={() => setAsking(false)}>
          그만두기
        </button>
        <button
          className="btn"
          style={{ background: 'var(--pen)', color: '#fff' }}
          onClick={signOut}
          disabled={busy}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
