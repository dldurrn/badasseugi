import { describe, expect, it } from 'vitest';
import { isTrialEvent, stepRate, sumTrial } from './trial';

describe('체험 횟수', () => {
  it('정해 둔 갈래만 받습니다 — DB 의 check 와 같습니다', () => {
    expect(isTrialEvent('start')).toBe(true);
    expect(isTrialEvent('cta')).toBe(true);
    expect(isTrialEvent('signup')).toBe(false);
    expect(isTrialEvent(1)).toBe(false);
    expect(isTrialEvent(undefined)).toBe(false);
  });

  it('날짜 이후만 더하고, 모르는 갈래는 버립니다', () => {
    const rows = [
      { day: '2026-10-20', event: 'start', count: 5 },
      { day: '2026-10-27', event: 'start', count: 3 },
      { day: '2026-10-27', event: 'finish', count: 2 },
      { day: '2026-10-28', event: 'cta', count: 1 },
      { day: '2026-10-28', event: 'oops', count: 9 },
    ];
    expect(sumTrial(rows, '2026-10-22')).toEqual({ start: 3, finish: 2, cta: 1 });
    expect(sumTrial(rows, '2026-10-01')).toEqual({ start: 8, finish: 2, cta: 1 });
  });

  it('아무도 안 왔으면 0% 가 아니라 —', () => {
    expect(stepRate(0, 0)).toBe('—');
    expect(stepRate(1, 3)).toBe('33%');
  });
});
