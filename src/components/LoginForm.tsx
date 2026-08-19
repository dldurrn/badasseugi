'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * 로그인·가입 — 보호자 계정으로만 만듭니다.
 * 자녀는 계정 없이 프로필+PIN으로 들어옵니다. (만 14세 미만 개인정보 최소화)
 */

type Mode = 'signin' | 'signup' | 'reset';

const HEADINGS: Record<Mode, { title: string; hint: string }> = {
  signin: { title: '받아쓰기 공책', hint: '보호자 계정으로 시작해요' },
  signup: { title: '처음 오셨네요', hint: '보호자 이메일로 계정을 만들어요' },
  reset: { title: '비밀번호 찾기', hint: '가입한 이메일로 재설정 메일을 보내요' },
};

/** 콜백 라우트가 넘겨준 실패 사유. 원인보다 다음에 할 일을 알려 줍니다. */
const CALLBACK_ERRORS: Record<string, string> = {
  cancelled: '로그인을 취소했어요. 다시 시작해 볼까요?',
  exchange: '로그인을 끝내지 못했어요. 다시 한 번 눌러 주세요.',
  expired: '메일 속 링크가 만료됐어요. 아래에서 메일을 다시 받아 주세요.',
  missing: '주소가 올바르지 않아요. 처음부터 다시 로그인해 주세요.',
};

export function LoginForm({ callbackError }: { callbackError?: string }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(
    callbackError
      ? { kind: 'error', text: CALLBACK_ERRORS[callbackError] ?? CALLBACK_ERRORS.missing }
      : null,
  );
  const [busy, setBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
  };

  const signInWithKakao = async () => {
    setBusy(true);
    setNotice(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setNotice({ kind: 'error', text: '카카오 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.' });
      setBusy(false);
    }
    // 성공하면 카카오 화면으로 넘어가므로 busy를 되돌리지 않습니다.
  };

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    const supabase = createClient();

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/password`,
      });
      setNotice(
        error
          ? { kind: 'error', text: '메일을 보내지 못했어요. 이메일 주소를 다시 확인해 주세요.' }
          : { kind: 'info', text: '재설정 메일을 보냈어요. 메일함을 확인해 주세요.' },
      );
      setBusy(false);
      return;
    }

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setNotice({
          kind: 'error',
          text:
            password.length < 6
              ? '비밀번호는 6자 이상으로 만들어 주세요.'
              : '가입하지 못했어요. 이미 가입한 이메일인지 확인해 주세요.',
        });
        setBusy(false);
        return;
      }
      // 이메일 확인이 켜져 있으면 세션이 바로 생기지 않습니다.
      if (data.session) {
        window.location.replace('/');
        return;
      }
      setNotice({
        kind: 'info',
        text: '확인 메일을 보냈어요. 메일 속 링크를 누르면 가입이 끝나요.',
      });
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setNotice({ kind: 'error', text: '이메일 또는 비밀번호를 다시 확인해 주세요.' });
      setBusy(false);
      return;
    }
    // 쿠키가 바뀐 뒤라 전체 새로고침으로 들어갑니다. 이후는 미들웨어가 안내합니다.
    window.location.replace('/');
  };

  const heading = HEADINGS[mode];
  const canSubmit =
    mode === 'reset' ? Boolean(email) : Boolean(email) && password.length > 0;

  return (
    <main className="page" style={{ paddingBottom: 40 }}>
      <header className="pb-8 pt-16 text-center">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full" style={{ background: 'var(--gold)' }} />
        <h1 className="display text-[30px] font-bold" style={{ color: 'var(--grid-deep)' }}>
          {heading.title}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {heading.hint}
        </p>
      </header>

      {mode !== 'reset' && (
        <>
          <button
            onClick={signInWithKakao}
            disabled={busy}
            className="btn btn-lg mb-3"
            style={{ background: '#FEE500', color: '#191600' }}
          >
            카카오로 시작하기
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'var(--rule)' }} />
            <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
              또는
            </span>
            <div className="h-px flex-1" style={{ background: 'var(--rule)' }} />
          </div>
        </>
      )}

      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit && !busy) submit();
        }}
      >
        <input
          className="field"
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        {mode !== 'reset' && (
          <input
            className="field"
            type="password"
            placeholder={mode === 'signup' ? '비밀번호 (6자 이상)' : '비밀번호'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
          />
        )}
        <button type="submit" disabled={busy || !canSubmit} className="btn btn-primary btn-lg">
          {mode === 'signin' ? '로그인' : mode === 'signup' ? '가입하기' : '재설정 메일 받기'}
        </button>
      </form>

      {notice && (
        <p
          className="mt-4 rounded-sm p-3 text-center text-sm"
          style={
            notice.kind === 'error'
              ? { background: 'var(--pen-tint)', color: 'var(--pen-deep)' }
              : { background: 'var(--grid-tint)', color: 'var(--grid-deep)' }
          }
          role="status"
        >
          {notice.text}
        </p>
      )}

      <div className="mt-5 flex flex-col items-center gap-1.5">
        {mode === 'signin' && (
          <>
            <button className="btn btn-quiet text-sm" onClick={() => switchMode('signup')}>
              계정이 없어요 — 가입하기
            </button>
            <button className="btn btn-quiet text-sm" onClick={() => switchMode('reset')}>
              비밀번호를 잊었어요
            </button>
          </>
        )}
        {mode !== 'signin' && (
          <button className="btn btn-quiet text-sm" onClick={() => switchMode('signin')}>
            로그인으로 돌아가기
          </button>
        )}
      </div>

      <p
        className="mt-8 text-center text-[11.5px] leading-relaxed"
        style={{ color: 'var(--ink-faint)' }}
      >
        아이의 이름 대신 별명만 사용해요.
        <br />
        보호자 계정으로만 가입하며, 아이는 따로 가입하지 않아요.
        <br />
        <a href="/privacy" style={{ textDecoration: 'underline' }}>
          개인정보처리방침
        </a>
      </p>
    </main>
  );
}
