/**
 * 로그인 전 체험의 횟수 — 갈래 이름과 운영 현황용 셈.
 *
 * | 갈래 | 언제 |
 * |---|---|
 * | `start`  | 「한 문장 써 보기」를 눌렀을 때 (한 번 들어와서 문장을 더 해도 한 번) |
 * | `finish` | 첫 문장을 제출해 채점표까지 봤을 때 |
 * | `cta`    | 가입·로그인 버튼을 눌렀을 때 |
 *
 * 화면에서도 부르므로 node 전용 모듈을 들이지 마세요.
 */

export const TRIAL_EVENTS = ['start', 'finish', 'cta'] as const;
export type TrialEvent = (typeof TRIAL_EVENTS)[number];

export function isTrialEvent(value: unknown): value is TrialEvent {
  return typeof value === 'string' && (TRIAL_EVENTS as readonly string[]).includes(value);
}

/** 기다리지 않습니다. 페이지를 떠나는 순간(가입 버튼)에도 닿도록 keepalive 로 보냅니다. */
export function countTrial(event: TrialEvent): void {
  try {
    void fetch('/api/trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 세기는 덤입니다. 실패해도 체험은 그대로 갑니다.
  }
}

export interface TrialRow {
  day: string;
  event: string;
  count: number;
}

export type TrialTotals = Record<TrialEvent, number>;

/** 날짜 키(YYYY-MM-DD) 이후의 합. 운영 현황이 「최근 7일 / 28일」로 나눠 씁니다. */
export function sumTrial(rows: TrialRow[], sinceKey: string): TrialTotals {
  const totals: TrialTotals = { start: 0, finish: 0, cta: 0 };
  for (const row of rows) {
    if (row.day >= sinceKey && isTrialEvent(row.event)) totals[row.event] += row.count;
  }
  return totals;
}

/** 앞 단계 대비 몇 %. 분모가 0이면 「—」 — 0% 와 「아직 아무도 안 옴」은 다릅니다. */
export function stepRate(part: number, whole: number): string {
  return whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`;
}
