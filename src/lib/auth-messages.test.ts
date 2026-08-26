import { describe, expect, it } from 'vitest';
import {
  authMessage,
  isAlreadyRegistered,
  isUnconfirmedEmail,
  type AuthErrorLike,
} from './auth-messages';

/**
 * 여기서 지키려는 것은 문구의 예쁨이 아니라 **원인마다 다른 말이 나오는가**입니다.
 * 예전에는 무엇이 틀렸든 한 문구였고, 그 탓에 메일 인증만 안 끝낸 부모가
 * 비밀번호를 몇 번이고 다시 쳤습니다.
 */

/** 실제로 봤던 Supabase 응답들. code가 실려 오는 경우와 안 오는 경우를 함께 둡니다. */
const CASES: { name: string; error: AuthErrorLike; expect: string }[] = [
  {
    name: '메일 인증 전 (code)',
    error: { code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' },
    expect: '아직 메일 인증을 끝내지 않았어요. 메일함에서 링크를 눌러 주세요.',
  },
  {
    name: '메일 인증 전 (code 없이 message만)',
    error: { status: 400, message: 'Email not confirmed' },
    expect: '아직 메일 인증을 끝내지 않았어요. 메일함에서 링크를 눌러 주세요.',
  },
  {
    name: '비밀번호가 틀림',
    error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    expect: '이메일 또는 비밀번호를 다시 확인해 주세요.',
  },
  {
    name: '이미 가입한 주소',
    error: { code: 'user_already_exists', status: 422, message: 'User already registered' },
    expect: '이미 가입한 이메일이에요. 로그인해 주세요.',
  },
  {
    name: '비밀번호가 짧음',
    error: {
      code: 'weak_password',
      status: 422,
      message: 'Password should be at least 6 characters.',
    },
    expect: '비밀번호는 6자 이상으로 만들어 주세요.',
  },
  {
    name: '이메일 형태가 아님',
    error: { status: 400, message: 'Unable to validate email address: invalid format' },
    expect: '이메일 주소 형태가 올바르지 않아요.',
  },
  {
    name: '너무 자주 보냄 (status만)',
    error: { status: 429, message: 'For security purposes, you can only request this after 51s' },
    expect: '잠시 뒤에 다시 시도해 주세요. 너무 자주 시도했어요.',
  },
  {
    name: '너무 자주 보냄 (code)',
    error: { code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' },
    expect: '잠시 뒤에 다시 시도해 주세요. 너무 자주 시도했어요.',
  },
  {
    name: '가입을 막아 둔 프로젝트',
    error: { code: 'signup_disabled', status: 422, message: 'Signups not allowed for this instance' },
    expect: '지금은 새 가입을 받지 않고 있어요.',
  },
];

describe('authMessage', () => {
  for (const c of CASES) {
    it(`${c.name} → 그 원인에 맞는 안내`, () => {
      expect(authMessage(c.error)).toBe(c.expect);
    });
  }

  it('모르는 오류는 영어 원문을 그대로 내보내지 않는다', () => {
    const text = authMessage({ status: 500, message: 'Internal Server Error' });
    expect(text).toBe('잠시 뒤에 다시 시도해 주세요.');
    // 부모 화면에 영어가 새어 나가면 안 됩니다.
    expect(text).not.toMatch(/[A-Za-z]/);
  });

  it('빈 오류에도 터지지 않는다', () => {
    expect(authMessage({})).toBe('잠시 뒤에 다시 시도해 주세요.');
  });

  it('원인이 다르면 안내도 다르다 — 한 문구로 뭉뚱그리지 않는다', () => {
    const texts = CASES.map((c) => authMessage(c.error));
    // 같은 원인을 code로 준 것과 message로만 준 것이 두 쌍 있습니다
    // (메일 인증 전, 너무 자주 보냄). 그 둘은 당연히 같은 말이 나와야 하고,
    // 나머지 7가지 원인은 서로 다른 말이어야 합니다.
    expect(new Set(texts).size).toBe(7);
  });

  it('모든 안내는 한글이고 다음에 할 일을 담는다', () => {
    for (const c of CASES) {
      expect(c.expect).toMatch(/[가-힣]/);
      expect(c.expect).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe('화면을 옮겨야 하는 두 경우', () => {
  it('메일 인증 전이면 「메일 다시 보내기」 화면으로', () => {
    expect(isUnconfirmedEmail({ code: 'email_not_confirmed' })).toBe(true);
    expect(isUnconfirmedEmail({ message: 'Email not confirmed' })).toBe(true);
    // 비밀번호가 틀린 것은 여기 걸리면 안 됩니다 — 걸리면 로그인 자체를 못 합니다.
    expect(isUnconfirmedEmail({ code: 'invalid_credentials' })).toBe(false);
    expect(isUnconfirmedEmail({})).toBe(false);
  });

  it('이미 가입한 주소면 로그인 화면으로', () => {
    expect(isAlreadyRegistered({ code: 'user_already_exists' })).toBe(true);
    expect(isAlreadyRegistered({ message: 'User already registered' })).toBe(true);
    expect(isAlreadyRegistered({ code: 'weak_password' })).toBe(false);
    expect(isAlreadyRegistered({})).toBe(false);
  });
});
