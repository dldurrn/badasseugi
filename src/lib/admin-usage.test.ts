import { describe, expect, it } from 'vitest';
import {
  activitySince,
  addDays,
  buildUsage,
  diffDays,
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

function day(id: string, d: string, sessions = 1): AdminActivityRow {
  return {
    family_id: id,
    day: d,
    sessions,
    exams: 0,
    dictation: sessions,
    spelling: 0,
    tts_chars: 50,
    ocr: 0,
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
