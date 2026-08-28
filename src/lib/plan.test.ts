import { describe, expect, it } from 'vitest';
import { LIMITS, PLAN_ENABLED, limitsFor, planOf } from './plan';

/**
 * 여기서 지킬 것 —
 * **아직 아무도 막히면 안 됩니다.**
 *
 * 결제가 없는 상태에서 한도만 걸면 돈을 낼 길도 없이 막히는 사람이 생깁니다.
 * 그리고 무료에서도 **원고지와 채점은 절대 잠기지 않아야** 합니다.
 * 그건 아이가 배우는 방식 그 자체라, 무료 사용자에게 더 나쁜 도구를 주는 셈이 됩니다.
 */

describe('아직 켜지 않았다', () => {
  it('결제가 붙기 전에는 모두 유료와 같은 것을 쓴다', () => {
    expect(PLAN_ENABLED).toBe(false);
    expect(limitsFor('free')).toEqual(LIMITS.paid);
    expect(limitsFor('paid')).toEqual(LIMITS.paid);
  });

  it('지금은 모두 무료 요금제로 셈한다', () => {
    expect(planOf(null)).toBe('free');
  });
});

describe('한도를 켰을 때 어떤 모습인가', () => {
  it('무료도 받아쓰기를 할 수 있다 — 소리를 아예 막지 않는다', () => {
    // 소리를 막으면 받아쓰기가 성립하지 않습니다. 받아쓸 게 없으니까요.
    expect(LIMITS.free.sessionsPerDay).toBeGreaterThan(0);
  });

  it('무료의 하루 세션 수가 넉넉하다 — 성실히 쓰는 집은 안 닿아야 한다', () => {
    // 매일 시키는 집도 보통 하루 1세션입니다.
    expect(LIMITS.free.sessionsPerDay ?? Infinity).toBeGreaterThanOrEqual(2);
  });

  it('사진으로 문제 넣기가 유료 쪽에 있다 — 원가가 붙는 유일한 기능', () => {
    expect(LIMITS.free.photoInput).toBe(false);
    expect(LIMITS.paid.photoInput).toBe(true);
  });

  it('유료는 자녀를 여럿 둘 수 있다', () => {
    expect(LIMITS.paid.children).toBeGreaterThan(LIMITS.free.children);
  });

  it('유료에는 세션 한도가 없다', () => {
    expect(LIMITS.paid.sessionsPerDay).toBeNull();
    expect(LIMITS.paid.reportWeeks).toBeNull();
  });

  it('무료도 이번 주 리포트는 본다 — 오늘 뭘 했는지는 알아야 한다', () => {
    expect(LIMITS.free.reportWeeks ?? Infinity).toBeGreaterThanOrEqual(1);
  });
});

describe('절대 잠그지 않는 것', () => {
  it('원고지·채점·오답노트는 한도 목록에 아예 없다', () => {
    /*
      목록에 없다는 것이 곧 「잠글 수 없다」는 뜻입니다.
      나중에 누가 여기에 wongoji: false 를 더하려 하면 이 테스트가 막습니다 —
      원고지는 제품의 정체성이고 원가도 0원입니다.
    */
    const 잠글수있는것 = Object.keys(LIMITS.free).sort();
    expect(잠글수있는것).toEqual(['children', 'photoInput', 'reportWeeks', 'sessionsPerDay']);
  });
});
