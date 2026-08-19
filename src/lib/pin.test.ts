import { describe, expect, it } from 'vitest';
import { hashPin, isValidPin, verifyPin } from './pin';
import { needsProfileSelection, parseView } from './profile';

describe('isValidPin', () => {
  it('숫자 4자리만 받는다', () => {
    expect(isValidPin('0000')).toBe(true);
    expect(isValidPin('1234')).toBe(true);
  });

  it('길이가 다르거나 숫자가 아니면 거절한다', () => {
    for (const bad of ['123', '12345', 'abcd', '12a4', '', ' 123', '12 4']) {
      expect(isValidPin(bad)).toBe(false);
    }
  });
});

describe('hashPin / verifyPin', () => {
  it('평문이 저장 문자열에 남지 않는다', async () => {
    const stored = await hashPin('1234');
    expect(stored).not.toContain('1234');
    expect(stored.startsWith('scrypt$')).toBe(true);
  });

  it('같은 PIN이라도 매번 다른 해시가 나온다 (소금)', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a).not.toBe(b);
  });

  it('맞는 PIN은 통과하고 틀린 PIN은 막는다', async () => {
    const stored = await hashPin('4821');
    expect(await verifyPin('4821', stored)).toBe(true);
    expect(await verifyPin('4822', stored)).toBe(false);
    expect(await verifyPin('1284', stored)).toBe(false);
  });

  it('잠금이 없는 프로필(null)은 어떤 PIN으로도 통과시키지 않는다', async () => {
    // 잠금 없이 들어가는 판단은 호출하는 쪽에서 pin_hash 유무로 합니다.
    // 여기서 true를 돌려주면 그 판단이 무너집니다.
    expect(await verifyPin('1234', null)).toBe(false);
  });

  it('저장 문자열이 망가져 있으면 통과시키지 않는다', async () => {
    for (const broken of ['', 'scrypt$', 'scrypt$abc', 'md5$a$b', '$$', 'nonsense']) {
      expect(await verifyPin('1234', broken)).toBe(false);
    }
  });

  it('형식이 어긋난 PIN은 해시를 만들지 않는다', async () => {
    await expect(hashPin('12')).rejects.toThrow();
  });
});

describe('parseView', () => {
  it('아는 값만 통과시키고 나머지는 미선택으로 본다', () => {
    expect(parseView('parent')).toBe('parent');
    expect(parseView('child')).toBe('child');
    expect(parseView('admin')).toBeNull();
    expect(parseView(undefined)).toBeNull();
  });
});

describe('needsProfileSelection', () => {
  it('아무것도 고르지 않았으면 선택 화면으로 보낸다', () => {
    expect(needsProfileSelection({ view: null, childId: null })).toBe(true);
    expect(needsProfileSelection({ view: null, childId: 'abc' })).toBe(true);
  });

  it('자녀 모드인데 자녀가 없으면 선택 화면으로 보낸다', () => {
    expect(needsProfileSelection({ view: 'child', childId: null })).toBe(true);
    expect(needsProfileSelection({ view: 'child', childId: 'abc' })).toBe(false);
  });

  it('보호자 모드는 자녀를 고르지 않아도 된다', () => {
    expect(needsProfileSelection({ view: 'parent', childId: null })).toBe(false);
  });
});
