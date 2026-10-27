import { LIMITS } from '@/lib/plan';
import { seoulWeekStart, toDateKeyInSeoul } from '@/lib/review';

/**
 * 운영 현황(`/admin`)의 셈. DB 함수가 돌려준 행을 화면에 쓸 모양으로 묶습니다.
 *
 * 네트워크도 화면도 없는 순수 함수라 테스트가 날짜 경계를 지킵니다.
 * **날짜는 모두 서울 기준 'YYYY-MM-DD' 문자열**로 다룹니다 — Vercel 은 UTC 로 돌아서,
 * Date 를 그대로 견주면 아침 9시 전 활동이 전날로 셉니다.
 */

/** `admin_families()` 한 줄 */
export interface AdminFamilyRow {
  family_id: string;
  email_masked: string | null;
  provider: string;
  signed_up_at: string;
  last_sign_in_at: string | null;
  children_count: number;
  sets_count: number;
  sessions_total: number;
  last_active_on: string | null;
  /** 어디서 왔나(0012). 그 전에 가입한 집과 마이그레이션 전에는 없습니다. */
  source?: string | null;
}

/** `admin_activity(since)` 한 줄 — 집 하나의 하루 */
export interface AdminActivityRow {
  family_id: string;
  day: string;
  sessions: number;
  exams: number;
  dictation: number;
  spelling: number;
  tts_chars: number;
  ocr: number;
}

export type UsageStatus = 'new' | 'steady' | 'sometimes' | 'fading' | 'gone' | 'signup-only';

export const STATUS_LABEL: Record<UsageStatus, string> = {
  new: '새로 옴',
  steady: '꾸준함',
  sometimes: '가끔',
  fading: '뜸해짐',
  gone: '떠남',
  'signup-only': '가입만',
};

/** 주 칸 수. 두 달이면 「꾸준한가」와 「언제 끊겼나」가 함께 보입니다. */
export const WEEKS = 8;
/** 잔존표에서 가입 뒤 몇째 주까지 보나 (0 = 가입한 주) */
export const COHORT_OFFSETS = 5;

/** 꾸준함의 기준 — 최근 28일 중 이만큼 이상 쓴 날이 있어야 합니다(주 1회꼴). */
const STEADY_DAYS_28 = 4;
const FADING_AFTER = 14;
const GONE_AFTER = 30;
const NEW_WITHIN = 7;

/**
 * 핵심 사용자 — 「이탈하지 않음」(꾸준함)보다 높은 문턱. **돈을 낼 만큼 쓰는 집**을 가립니다.
 * 주 2회꼴로 들어오고, 끝까지 마친 세션이 열 번은 되어야 합니다.
 * 처음 정한 값이라 실제 분포를 보고 여기서 고칩니다.
 */
export const CORE_DAYS_28 = 8;
export const CORE_SESSIONS_28 = 10;

/**
 * 「지금 무료 한도를 켰다면」 지난 28일에 막혔을 자리.
 * **실제로 막는 것이 아닙니다**(`PLAN_ENABLED` 는 그대로) — 한도를 정하는 재료일 뿐입니다.
 * 리포트 기간·AI 짝은 쓴 기록이 없어 대 볼 수 없습니다.
 */
export interface LimitHits {
  /** 무료 하루 세션 수를 넘긴 날 수 */
  sessionDays: number;
  /** 무료 아이 수를 넘김 */
  children: boolean;
  /** 사진으로 문제를 넣음(무료는 못 씀) */
  photo: boolean;
}

export function limitHits(input: {
  children: number;
  last28: Pick<AdminActivityRow, 'sessions' | 'ocr'>[];
}): LimitHits {
  const free = LIMITS.free;
  return {
    sessionDays:
      free.sessionsPerDay === null
        ? 0
        : input.last28.filter((d) => d.sessions > free.sessionsPerDay!).length,
    children: input.children > free.children,
    photo: !free.photoInput && input.last28.some((d) => d.ocr > 0),
  };
}

export function hitsAny(h: LimitHits): boolean {
  return h.sessionDays > 0 || h.children || h.photo;
}

/** 막혔을 자리 수 — 「한도에 닿음」 정렬에 씁니다. 세션은 날 수만큼 무겁게 칩니다. */
function hitWeight(h: LimitHits): number {
  return h.sessionDays + (h.children ? 1 : 0) + (h.photo ? 1 : 0);
}

export interface FamilyUsage {
  row: AdminFamilyRow;
  status: UsageStatus;
  signupDay: string;
  /** 마지막 활동에서 오늘까지 며칠. 한 번도 안 썼으면 null */
  daysSinceActive: number | null;
  activeDays28: number;
  sessions28: number;
  /** 핵심 사용자인가 (`CORE_DAYS_28`·`CORE_SESSIONS_28`) */
  core: boolean;
  limits: LimitHits;
  /** 주마다 쓴 날 수(0~7), 오래된 주부터 */
  weeks: number[];
  /** 최근 28일의 활동, 최근 것부터 */
  recent: AdminActivityRow[];
}

export interface Cohort {
  week: string;
  signups: number;
  /** 가입 뒤 n째 주에 한 번이라도 쓴 비율(%). 아직 오지 않은 주는 null */
  retained: (number | null)[];
}

/** 출처 한 갈래 — 얼마나 오고, 와서 남는가 */
export interface SourceStat {
  source: string | null;
  families: number;
  activeThisWeek: number;
  /** 그중 핵심 사용자 */
  core: number;
  retained14: { kept: number; eligible: number };
}

export interface UsageSummary {
  today: string;
  weekStarts: string[];
  totals: {
    families: number;
    activeThisWeek: number;
    activeLastWeek: number;
    /** 가입한 지 14일이 지난 집 중, 14일째 이후에도 쓴 집 */
    retained14: { kept: number; eligible: number };
    core: number;
    /** 무료 한도를 켰다면 막혔을 집 — 하나라도 / 갈래별 / 그중 핵심 사용자 */
    wouldHit: { any: number; sessions: number; children: number; photo: number; core: number };
  };
  families: FamilyUsage[];
  cohorts: Cohort[];
  /** 많이 온 갈래부터. 「모름」은 맨 아래 */
  sources: SourceStat[];
}

// --- 날짜 문자열 셈 ---------------------------------------------------------

function toUtc(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  return new Date(toUtc(key) + n * 86_400_000).toISOString().slice(0, 10);
}

/** a - b (일) */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(a) - toUtc(b)) / 86_400_000);
}

/** DB 가 돌려준 날짜는 'YYYY-MM-DD' 이지만, 혹시 시각이 붙어 와도 날짜만 씁니다. */
function dayOf(value: string): string {
  return value.slice(0, 10);
}

/** 활동 표를 이 날부터 가져옵니다 — 화면의 가장 오래된 주 칸의 월요일. */
export function activitySince(now: Date = new Date()): string {
  return addDays(seoulWeekStart(now), -7 * (WEEKS - 1));
}

export function statusOf(input: {
  today: string;
  signupDay: string;
  lastActive: string | null;
  activeDays28: number;
}): UsageStatus {
  const age = diffDays(input.today, input.signupDay);
  if (age < NEW_WITHIN) return 'new';
  if (!input.lastActive) return 'signup-only';
  const since = diffDays(input.today, input.lastActive);
  if (since >= GONE_AFTER) return 'gone';
  if (since >= FADING_AFTER) return 'fading';
  return input.activeDays28 >= STEADY_DAYS_28 ? 'steady' : 'sometimes';
}

export function buildUsage(
  families: AdminFamilyRow[],
  activity: AdminActivityRow[],
  now: Date = new Date(),
): UsageSummary {
  const today = toDateKeyInSeoul(now);
  const thisWeek = seoulWeekStart(now);
  const weekStarts = Array.from({ length: WEEKS }, (_, i) =>
    addDays(thisWeek, -7 * (WEEKS - 1 - i)),
  );
  const from28 = addDays(today, -27);

  const byFamily = new Map<string, AdminActivityRow[]>();
  for (const a of activity) {
    const row = { ...a, day: dayOf(a.day) };
    const list = byFamily.get(row.family_id);
    if (list) list.push(row);
    else byFamily.set(row.family_id, [row]);
  }

  const usage: FamilyUsage[] = families.map((row) => {
    const days = byFamily.get(row.family_id) ?? [];
    const signupDay = toDateKeyInSeoul(new Date(row.signed_up_at));
    const lastActive = row.last_active_on ? dayOf(row.last_active_on) : null;
    const last28 = days.filter((d) => d.day >= from28 && d.day <= today);
    const activeDays28 = last28.length;
    const sessions28 = last28.reduce((sum, d) => sum + d.sessions, 0);

    const weeks = weekStarts.map(
      (start) => days.filter((d) => d.day >= start && d.day <= addDays(start, 6)).length,
    );

    return {
      row,
      signupDay,
      status: statusOf({ today, signupDay, lastActive, activeDays28 }),
      daysSinceActive: lastActive ? diffDays(today, lastActive) : null,
      activeDays28,
      sessions28,
      core: activeDays28 >= CORE_DAYS_28 && sessions28 >= CORE_SESSIONS_28,
      limits: limitHits({ children: row.children_count, last28 }),
      weeks,
      recent: [...last28].sort((a, b) => (a.day < b.day ? 1 : -1)),
    };
  });

  sortFamilies(usage, 'active');

  const activeIn = (from: string, to: string) =>
    new Set(activity.filter((a) => dayOf(a.day) >= from && dayOf(a.day) <= to).map((a) => a.family_id))
      .size;

  const activeThisWeekIds = new Set(
    activity.filter((a) => dayOf(a.day) >= thisWeek && dayOf(a.day) <= today).map((a) => a.family_id),
  );

  /** 가입한 지 14일 지난 집 중 14일째 이후에도 쓴 집 */
  const retained14 = (list: FamilyUsage[]) => {
    let eligible = 0;
    let kept = 0;
    for (const f of list) {
      if (diffDays(today, f.signupDay) < 14) continue;
      eligible += 1;
      const last = f.row.last_active_on ? dayOf(f.row.last_active_on) : null;
      if (last && diffDays(last, f.signupDay) >= 14) kept += 1;
    }
    return { kept, eligible };
  };

  const bySource = new Map<string | null, FamilyUsage[]>();
  for (const f of usage) {
    const key = f.row.source ?? null;
    const list = bySource.get(key);
    if (list) list.push(f);
    else bySource.set(key, [f]);
  }
  const sources: SourceStat[] = [...bySource.entries()]
    .map(([source, list]) => ({
      source,
      families: list.length,
      activeThisWeek: list.filter((f) => activeThisWeekIds.has(f.row.family_id)).length,
      core: list.filter((f) => f.core).length,
      retained14: retained14(list),
    }))
    .sort((a, b) =>
      a.source === null ? 1 : b.source === null ? -1 : b.families - a.families,
    );

  const cohorts: Cohort[] = weekStarts.map((week) => {
    const members = usage.filter((f) => seoulWeekStartOfKey(f.signupDay) === week);
    const retained = Array.from({ length: COHORT_OFFSETS }, (_, off) => {
      const start = addDays(week, 7 * off);
      if (start > today || members.length === 0) return null;
      const end = addDays(start, 6);
      const active = members.filter((f) =>
        (byFamily.get(f.row.family_id) ?? []).some((d) => d.day >= start && d.day <= end),
      ).length;
      return Math.round((active / members.length) * 100);
    });
    return { week, signups: members.length, retained };
  });

  return {
    today,
    weekStarts,
    totals: {
      families: families.length,
      activeThisWeek: activeThisWeekIds.size,
      activeLastWeek: activeIn(addDays(thisWeek, -7), addDays(thisWeek, -1)),
      retained14: retained14(usage),
      core: usage.filter((f) => f.core).length,
      wouldHit: {
        any: usage.filter((f) => hitsAny(f.limits)).length,
        sessions: usage.filter((f) => f.limits.sessionDays > 0).length,
        children: usage.filter((f) => f.limits.children).length,
        photo: usage.filter((f) => f.limits.photo).length,
        core: usage.filter((f) => f.core && hitsAny(f.limits)).length,
      },
    },
    families: usage,
    cohorts: cohorts.reverse(),
    sources,
  };
}

/** 날짜 문자열의 그 주 월요일 */
function seoulWeekStartOfKey(key: string): string {
  const dow = (new Date(toUtc(key)).getUTCDay() + 6) % 7; // 월=0
  return addDays(key, -dow);
}

// --- 정렬·거르기 -------------------------------------------------------------

export type SortKey = 'active' | 'sessions' | 'recent' | 'signup' | 'limits';
export const SORT_LABEL: Record<SortKey, string> = {
  active: '많이 씀',
  sessions: '세션 수',
  recent: '최근 활동',
  signup: '가입일',
  limits: '한도에 닿음',
};

export type FilterKey = 'all' | 'core' | 'limits' | 'steady' | 'fading';
export const FILTER_LABEL: Record<FilterKey, string> = {
  all: '전체',
  core: '핵심 사용자',
  limits: '한도에 닿음',
  steady: '꾸준함',
  fading: '뜸해짐·떠남',
};

/** 주소의 값을 믿지 않습니다 — 모르는 값이면 기본으로. */
export function parseSort(value: string | undefined): SortKey {
  return value && Object.hasOwn(SORT_LABEL, value) ? (value as SortKey) : 'active';
}
export function parseFilter(value: string | undefined): FilterKey {
  return value && Object.hasOwn(FILTER_LABEL, value) ? (value as FilterKey) : 'all';
}

/** 최근에 쓴 집이 앞. 한 번도 안 쓴 집은 맨 뒤 */
const byRecent = (a: FamilyUsage, b: FamilyUsage) =>
  (a.daysSinceActive ?? Infinity) - (b.daysSinceActive ?? Infinity);

/** 제자리에서 정렬합니다. 같으면 언제나 최근에 쓴 집이 위. */
export function sortFamilies(list: FamilyUsage[], key: SortKey): FamilyUsage[] {
  const primary: Record<SortKey, (a: FamilyUsage, b: FamilyUsage) => number> = {
    active: (a, b) => b.activeDays28 - a.activeDays28,
    sessions: (a, b) => b.sessions28 - a.sessions28,
    recent: () => 0,
    signup: (a, b) => (a.row.signed_up_at < b.row.signed_up_at ? 1 : a.row.signed_up_at > b.row.signed_up_at ? -1 : 0),
    limits: (a, b) => hitWeight(b.limits) - hitWeight(a.limits) || b.activeDays28 - a.activeDays28,
  };
  return list.sort((a, b) => primary[key](a, b) || byRecent(a, b));
}

export function filterFamilies(list: FamilyUsage[], key: FilterKey): FamilyUsage[] {
  switch (key) {
    case 'all':
      return list;
    case 'core':
      return list.filter((f) => f.core);
    case 'limits':
      return list.filter((f) => hitsAny(f.limits));
    case 'steady':
      return list.filter((f) => f.status === 'steady');
    case 'fading':
      return list.filter((f) => f.status === 'fading' || f.status === 'gone');
  }
}
