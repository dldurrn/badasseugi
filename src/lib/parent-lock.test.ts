import { describe, expect, it } from 'vitest';
import { lockResetApplies, shouldAskToSetLock } from './parent-lock';

describe('shouldAskToSetLock — 입구에서 비밀번호를 정하라고 물을까', () => {
  const today = '2026-10-07';

  it('잠금이 없고 미룬 적이 없으면 묻습니다(기본으로 잠금)', () => {
    expect(shouldAskToSetLock({ locked: false, laterOn: null, today })).toBe(true);
  });

  it('이미 잠겨 있으면 묻지 않습니다', () => {
    expect(shouldAskToSetLock({ locked: true, laterOn: null, today })).toBe(false);
  });

  it('오늘 「나중에」를 눌렀으면 오늘은 다시 묻지 않습니다', () => {
    expect(shouldAskToSetLock({ locked: false, laterOn: today, today })).toBe(false);
  });

  it('어제 미뤘으면 오늘은 다시 묻습니다', () => {
    expect(shouldAskToSetLock({ locked: false, laterOn: '2026-10-06', today })).toBe(true);
  });

  it('아주 오래전에 미뤘어도 묻습니다', () => {
    expect(shouldAskToSetLock({ locked: false, laterOn: '2026-01-01', today })).toBe(true);
  });
});

describe('lockResetApplies — 잊어서 다시 로그인한 사람', () => {
  const mark = String(Date.parse('2026-10-07T10:00:00Z'));

  it('표시를 남긴 뒤에 로그인했으면 건너뜁니다', () => {
    expect(lockResetApplies(mark, '2026-10-07T10:05:00Z')).toBe(true);
  });

  it('표시만 남기고 로그인은 안 했으면(로그아웃 없이 들어오려는 경우) 안 됩니다', () => {
    expect(lockResetApplies(mark, '2026-10-07T09:00:00Z')).toBe(false);
  });

  it('표시가 없으면 안 됩니다', () => {
    expect(lockResetApplies(undefined, '2026-10-07T10:05:00Z')).toBe(false);
    expect(lockResetApplies('', '2026-10-07T10:05:00Z')).toBe(false);
  });

  it('로그인 시각을 모르면 안 됩니다', () => {
    expect(lockResetApplies(mark, undefined)).toBe(false);
    expect(lockResetApplies(mark, null)).toBe(false);
  });

  it('숫자가 아닌 표시나 깨진 날짜는 안 됩니다', () => {
    expect(lockResetApplies('abc', '2026-10-07T10:05:00Z')).toBe(false);
    expect(lockResetApplies(mark, 'not-a-date')).toBe(false);
  });
});
