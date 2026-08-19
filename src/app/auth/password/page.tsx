'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * 비밀번호 재설정 — 메일 링크로 들어온 다음 단계.
 *
 * 콜백 라우트가 recovery 세션을 만들어 준 상태로 들어옵니다.
 * 세션이 없다면 링크가 만료된 것이므로 다시 받도록 안내합니다.
 */
export default function PasswordPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setReady(Boolean(data.user)));
  }, []);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage('바꾸지 못했어요. 6자 이상으로 다시 입력해 주세요.');
      setBusy(false);
      return;
    }
    window.location.replace('/');
  };

  return (
    <main className="page" style={{ paddingBottom: 40 }}>
      <header className="pb-6 pt-16 text-center">
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--grid-deep)' }}>
          새 비밀번호
        </h1>
      </header>

      {ready === false ? (
        <div className="surface p-5 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            링크가 만료됐어요. 로그인 화면에서 재설정 메일을 다시 받아 주세요.
          </p>
          <a href="/login" className="btn btn-primary btn-lg mt-4">
            로그인 화면으로
          </a>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (password.length >= 6 && !busy) save();
          }}
        >
          <input
            className="field"
            type="password"
            placeholder="새 비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={busy || ready !== true || password.length < 6}
          >
            비밀번호 바꾸기
          </button>
        </form>
      )}

      {message && (
        <p
          className="mt-4 rounded-sm p-3 text-center text-sm"
          style={{ background: 'var(--pen-tint)', color: 'var(--pen-deep)' }}
          role="status"
        >
          {message}
        </p>
      )}
    </main>
  );
}
