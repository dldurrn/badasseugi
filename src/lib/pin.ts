import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { PIN_LENGTH, isValidPin } from '@/lib/profile';

/**
 * 자녀 프로필 PIN.
 *
 * 평문은 어디에도 남기지 않습니다. 검증도 서버에서만 합니다.
 * (children.pin_hash 는 부모 RLS로 읽히므로, 클라이언트에서 비교하면
 *  해시가 브라우저로 내려가 버립니다. 그래서 라우트 핸들러에서만 다룹니다.)
 *
 * 외부 의존성을 늘리지 않으려고 Node 기본 scrypt를 씁니다.
 * 4자리 숫자는 경우의 수가 1만 개뿐이라 해시 강도만으로는 못 막습니다.
 * 이 PIN의 목적은 형제자매가 남의 기록을 건드리지 않게 하는 정도이지,
 * 공격자를 막는 장치가 아닙니다.
 */

export { PIN_LENGTH, isValidPin };

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const SCHEME = 'scrypt';

function derive(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** 저장 형식: `scrypt$<salt base64>$<key base64>` */
export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error('PIN은 숫자 4자리여야 합니다.');
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(pin, salt);
  return `${SCHEME}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored || !isValidPin(pin)) return false;

  const [scheme, saltPart, keyPart] = stored.split('$');
  if (scheme !== SCHEME || !saltPart || !keyPart) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltPart, 'base64');
    expected = Buffer.from(keyPart, 'base64');
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await derive(pin, salt);
  // 길이가 같을 때만 비교해야 timingSafeEqual이 예외를 던지지 않습니다.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
