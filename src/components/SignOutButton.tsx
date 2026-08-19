'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * 로그아웃.
 *
 * 한 번 더 묻습니다. 계정 비밀번호를 기억하지 못하는 상태에서 잘못 누르면
 * 메일 확인까지 거쳐야 돌아올 수 있습니다.
 *
 * 프로필 선택 쿠키를 먼저 지웁니다.
 * 로그아웃한 뒤에는 세션이 없어 서버 라우트를 부를 수 없고,
 * 쿠키가 남아 있으면 다음 로그인 때 엉뚱한 프로필로 들어가게 됩니다.
 */
export function SignOutButton() {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    await fetch('/api/profile', { method: 'DELETE' }).catch(() => null);
    await createClient().auth.signOut();
    window.location.replace('/login');
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
