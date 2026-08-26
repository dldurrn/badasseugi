/**
 * Supabase가 돌려준 인증 오류를 부모가 읽을 말로 바꿉니다.
 *
 * 예전에는 무엇이 틀렸든 한 문구만 띄웠습니다 —
 * 가입은 "이미 가입한 이메일인지 확인해 주세요", 로그인은 "이메일 또는 비밀번호를 확인해 주세요".
 * 그래서 **메일 인증만 안 끝낸 사람이 비밀번호가 틀린 줄 알고 몇 번을 다시 쳤습니다.**
 * 원인이 다르면 할 일도 다른데, 같은 말을 하고 있었던 셈입니다.
 *
 * 화면(`LoginForm`)이 아니라 여기 두는 이유는 테스트 때문입니다.
 * 화면 파일은 React와 supabase 클라이언트를 끌고 와서 node 환경에서 못 부릅니다.
 */

/** supabase-js의 `AuthError`에서 우리가 보는 것만 추린 모양 */
export interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

/** 메일 인증이 안 끝나 로그인이 막힌 경우인가 — 이때만 「메일 다시 보내기」 화면으로 보냅니다. */
export function isUnconfirmedEmail(error: AuthErrorLike): boolean {
  return error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message ?? '');
}

/** 이미 가입한 주소인가 — 이때는 로그인 화면으로 옮겨 줍니다. */
export function isAlreadyRegistered(error: AuthErrorLike): boolean {
  return error.code === 'user_already_exists' || /already/i.test(error.message ?? '');
}

/**
 * `code`는 최신 supabase-js가 주고, 없는 경우를 대비해 `message`도 함께 봅니다.
 * 어느 쪽으로도 못 가리면 영어 원문 대신 "다시 시도" 안내를 냅니다 —
 * 원문을 그대로 띄우면 부모가 더 막막합니다.
 */
export function authMessage(error: AuthErrorLike): string {
  const code = error.code ?? '';
  const text = (error.message ?? '').toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => text.includes(n));

  if (isUnconfirmedEmail(error)) {
    return '아직 메일 인증을 끝내지 않았어요. 메일함에서 링크를 눌러 주세요.';
  }
  if (code === 'invalid_credentials' || has('invalid login credentials')) {
    return '이메일 또는 비밀번호를 다시 확인해 주세요.';
  }
  if (isAlreadyRegistered(error)) {
    return '이미 가입한 이메일이에요. 로그인해 주세요.';
  }
  if (code === 'weak_password' || has('password should be', 'at least 6')) {
    return '비밀번호는 6자 이상으로 만들어 주세요.';
  }
  if (has('unable to validate email', 'invalid format', 'invalid email')) {
    return '이메일 주소 형태가 올바르지 않아요.';
  }
  // 메일을 너무 자주 보냈거나 로그인을 너무 자주 시도한 경우.
  // 429는 코드가 안 실려 와도 잡히도록 상태 코드로도 봅니다.
  if (error.status === 429 || code.includes('rate_limit') || has('rate limit', 'too many')) {
    return '잠시 뒤에 다시 시도해 주세요. 너무 자주 시도했어요.';
  }
  if (has('signups not allowed', 'signup is disabled')) {
    return '지금은 새 가입을 받지 않고 있어요.';
  }
  return '잠시 뒤에 다시 시도해 주세요.';
}
