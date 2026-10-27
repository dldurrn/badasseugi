import { describe, expect, it } from 'vitest';
import {
  activitySince,
  addDays,
  buildUsage,
  CORE_DAYS_28,
  CORE_SESSIONS_28,
  diffDays,
  filterFamilies,
  limitHits,
  parseFilter,
  parseSort,
  sortFamilies,
  statusOf,
  WEEKS,
  type AdminActivityRow,
  type AdminFamilyRow,
} from './admin-usage';

// 2026-10-17(토) 서울 오후 3시. 이 주의 월요일은 10-12.
const NOW = new Date('2026-10-17T06:00:00Z');

function family(id: string, signedUp: string, lastActive: string | null): AdminFamilyRow {
  return {
    family_id: id,
    email_masked: 'ab***@x.com',
    provider: 'email',
    signed_up_at: signedUp,
    last_sign_in_at: null,
    children_count: 1,
    sets_count: 0,
    sessions_total: 0,
    last_active_on: lastActive,
  };
}

function day(id: string, d: string, sessions = 1, ocr = 0): AdminActivityRow {
  return {
    family_id: id,
    day: d,
    sessions,
    exams: 0,
    dictation: sessions,
    spelling: 0,
    tts_chars: 50,
    ocr,
  };
}

describe('날짜 셈', () => {
  it('더하고 빼기가 달·해를 넘어갑니다', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(diffDays('2026-03-01', '2026-02-27')).toBe(2);
  });

  it('활동 표는 가장 오래된 주 칸의 월요일부터 가져옵니다', () => {
    expect(activitySince(NOW)).toBe(addDays('2026-10-12', -7 * (WEEKS - 1)));
  });

  it('서울 자정 직후는 UTC 로는 전날이지만 서울 날짜로 셉니다', () => {
    // 서울 10-12(월) 00:30 = UTC 10-11 15:30
    const s = buildUsage([], [], new Date('2026-10-11T15:30:00Z'));
    expect(s.today).toBe('2026-10-12');
    expect(s.weekStarts.at(-1)).toBe('2026-10-12');
  });
});

describe('상태', () => {
  const base = { today: '2026-10-17', signupDay: '2026-09-01' };

  it('가입 7일 안이면 아직 안 썼어도 「새로 옴」', () => {
    expect(statusOf({ today: '2026-10-17', signupDay: '2026-10-12', lastActive: null, activeDays28: 0 })).toBe('new');
  });
  it('7일이 지났는데 한 번도 안 썼으면 「가입만」', () => {
    expect(statusOf({ ...base, lastActive: null, activeDays28: 0 })).toBe('signup-only');
  });
  it('28일 중 4일 이상이면 「꾸준함」, 아니면 「가끔」', () => {
    expect(statusOf({ ...base, lastActive: '2026-10-16', activeDays28: 4 })).toBe('steady');
    expect(statusOf({ ...base, lastActive: '2026-10-16', activeDays28: 3 })).toBe('sometimes');
  });
  it('14일 쉬면 「뜸해짐」, 30일 쉬면 「떠남」', () => {
    expect(statusOf({ ...base, lastActive: '2026-10-03', activeDays28: 5 })).toBe('fading');
    expect(statusOf({ ...base, lastActive: '2026-09-17', activeDays28: 0 })).toBe('gone');
  });
});

describe('묶기', () => {
  it('주 칸은 그 주에 쓴 날 수이고, 많이 쓴 집이 위로 옵니다', () => {
    const fams = [family('a', '2026-09-01T00:00:00Z', '2026-10-01'), family('b', '2026-09-01T00:00:00Z', '2026-10-16')];
    const acts = [
      day('a', '2026-10-01'),
      day('b', '2026-10-13'),
      day('b', '2026-10-14'),
      day('b', '2026-10-16'),
      day('b', '2026-10-06'),
    ];
    const s = buildUsage(fams, acts, NOW);
    expect(s.families.map((f) => f.row.family_id)).toEqual(['b', 'a']);
    const b = s.families[0];
    expect(b.weeks.at(-1)).toBe(3);
    expect(b.weeks.at(-2)).toBe(1);
    expect(b.status).toBe('steady');
    expect(b.recent[0].day).toBe('2026-10-16');
    expect(s.totals.activeThisWeek).toBe(1);
    expect(s.totals.activeLastWeek).toBe(1);
  });

  it('활동 표 밖의 옛 활동도 마지막 활동으로 잡아 「가입만」으로 오해하지 않습니다', () => {
    const s = buildUsage([family('a', '2026-05-01T00:00:00Z', '2026-06-01')], [], NOW);
    expect(s.families[0].status).toBe('gone');
    expect(s.families[0].daysSinceActive).toBe(diffDays('2026-10-17', '2026-06-01'));
  });

  it('14일 잔존은 가입한 지 14일 지난 집만 셉니다', () => {
    const s = buildUsage(
      [
        family('kept', '2026-09-01T00:00:00Z', '2026-09-20'),
        family('left', '2026-09-01T00:00:00Z', '2026-09-03'),
        family('young', '2026-10-10T00:00:00Z', '2026-10-16'),
      ],
      [],
      NOW,
    );
    expect(s.totals.retained14).toEqual({ kept: 1, eligible: 2 });
  });

  it('출처별로 갈라 세고, 「모름」은 맨 아래', () => {
    const s = buildUsage(
      [
        { ...family('a', '2026-09-01T00:00:00Z', '2026-10-16'), source: 'insta' },
        { ...family('b', '2026-09-01T00:00:00Z', '2026-09-02'), source: 'insta' },
        { ...family('c', '2026-09-01T00:00:00Z', '2026-10-16'), source: 'blog' },
        family('d', '2026-09-01T00:00:00Z', null),
      ],
      [day('a', '2026-10-16'), day('c', '2026-10-13')],
      NOW,
    );
    expect(s.sources.map((x) => x.source)).toEqual(['insta', 'blog', null]);
    expect(s.sources[0]).toMatchObject({ families: 2, activeThisWeek: 1, retained14: { kept: 1, eligible: 2 } });
  });

  it('잔존표: 가입 주별로, 아직 안 온 주는 비웁니다', () => {
    const s = buildUsage(
      [family('a', '2026-10-05T03:00:00Z', '2026-10-14'), family('b', '2026-10-06T03:00:00Z', '2026-10-06')],
      [day('a', '2026-10-05'), day('b', '2026-10-06'), day('a', '2026-10-14')],
      NOW,
    );
    const cohort = s.cohorts.find((c) => c.week === '2026-10-05')!;
    expect(cohort.signups).toBe(2);
    expect(cohort.retained.slice(0, 3)).toEqual([100, 50, null]);
    // 최근 가입 주가 위
    expect(s.cohorts[0].week).toBe('2026-10-12');
  });

  it('가입 시각은 서울 날짜로 가입 주를 정합니다', () => {
    // UTC 10-11(일) 16:00 = 서울 10-12(월) 01:00 → 10-12 주
    const s = buildUsage([family('a', '2026-10-11T16:00:00Z', null)], [], NOW);
    expect(s.cohorts.find((c) => c.week === '2026-10-12')!.signups).toBe(1);
    expect(s.cohorts.find((c) => c.week === '2026-10-05')!.signups).toBe(0);
  });
});

describe('핵심 사용자와 한도', () => {
  /** 10-17 에서 거슬러 n 일을 연달아 */
  const days = (id: string, n: number, sessions = 1) =>
    Array.from({ length: n }, (_, i) => day(id, addDays('2026-10-17', -i), sessions));

  it('28일 중 8일, 세션 10회를 둘 다 넘어야 핵심 사용자', () => {
    const fams = ['a', 'b', 'c'].map((id) => family(id, '2026-09-01T00:00:00Z', '2026-10-17'));
    const s = buildUsage(
      fams,
      [
        ...days('a', CORE_DAYS_28, 2), // 8일 · 16회
        ...days('b', CORE_DAYS_28 - 1, 3), // 7일 · 21회
        ...days('c', CORE_DAYS_28, 1), // 8일 · 8회
      ],
      NOW,
    );
    const core = Object.fromEntries(s.families.map((f) => [f.row.family_id, f.core]));
    expect(core).toEqual({ a: true, b: false, c: false });
    expect(CORE_SESSIONS_28).toBe(10);
    expect(s.totals.core).toBe(1);
  });

  it('무료 한도를 넘긴 날·아이 수·사진을 셉니다 — 28일 밖은 안 셉니다', () => {
    const h = limitHits({
      children: 2,
      last28: [
        { sessions: 3, ocr: 0 },
        { sessions: 2, ocr: 0 },
        { sessions: 5, ocr: 1 },
      ],
    });
    expect(h).toEqual({ sessionDays: 2, children: true, photo: true });
    expect(limitHits({ children: 1, last28: [{ sessions: 2, ocr: 0 }] })).toEqual({
      sessionDays: 0,
      children: false,
      photo: false,
    });

    const s = buildUsage(
      [family('a', '2026-08-01T00:00:00Z', '2026-10-16')],
      [day('a', '2026-09-01', 9, 2), day('a', '2026-10-16', 1)],
      NOW,
    );
    expect(s.families[0].limits).toEqual({ sessionDays: 0, children: false, photo: false });
    expect(s.totals.wouldHit.any).toBe(0);
  });

  it('요약은 갈래별로, 핵심 사용자 중 막힐 집도 따로', () => {
    const s = buildUsage(
      [
        { ...family('a', '2026-09-01T00:00:00Z', '2026-10-17'), children_count: 2 },
        family('b', '2026-09-01T00:00:00Z', '2026-10-17'),
        family('c', '2026-09-01T00:00:00Z', '2026-10-17'),
      ],
      [...days('a', 8, 3), day('b', '2026-10-17', 1, 1), day('c', '2026-10-17')],
      NOW,
    );
    expect(s.totals.wouldHit).toEqual({ any: 2, sessions: 1, children: 1, photo: 1, core: 1 });
  });
});

describe('정렬·거르기', () => {
  const s = buildUsage(
    [
      family('old', '2026-08-01T00:00:00Z', '2026-10-17'),
      { ...family('kids', '2026-10-01T00:00:00Z', '2026-10-10'), children_count: 3 },
      family('gone', '2026-07-01T00:00:00Z', '2026-09-01'),
    ],
    [
      day('old', '2026-10-17'),
      day('old', '2026-10-16'),
      day('kids', '2026-10-10', 6),
    ],
    NOW,
  );
  const ids = (key: Parameters<typeof sortFamilies>[1]) =>
    sortFamilies([...s.families], key).map((f) => f.row.family_id);

  it('기준마다 순서가 바뀝니다', () => {
    expect(ids('active')).toEqual(['old', 'kids', 'gone']);
    expect(ids('sessions')).toEqual(['kids', 'old', 'gone']);
    expect(ids('recent')).toEqual(['old', 'kids', 'gone']);
    expect(ids('signup')).toEqual(['kids', 'old', 'gone']);
    expect(ids('limits')[0]).toBe('kids');
  });

  it('거르기', () => {
    const f = (key: Parameters<typeof filterFamilies>[1]) =>
      filterFamilies(s.families, key).map((x) => x.row.family_id);
    expect(f('limits')).toEqual(['kids']);
    expect(f('fading')).toEqual(['gone']);
    expect(f('all')).toHaveLength(3);
  });

  it('주소에 모르는 값이 오면 기본으로', () => {
    expect(parseSort('limits')).toBe('limits');
    expect(parseSort('toString')).toBe('active');
    expect(parseSort(undefined)).toBe('active');
    expect(parseFilter('core')).toBe('core');
    expect(parseFilter('<x>')).toBe('all');
  });
});
