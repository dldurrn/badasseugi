import type { Mode, Module } from './types';

/**
 * 리포트의 셈 — 화면도 DB도 모르는 순수 함수들.
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 갈래를 나누나
 *
 * 예전에는 세션 점수를 **전부 한 평균**에 넣었습니다.
 * 그러면 받아쓰기 20단계 시험과 맞춤법 1단계 연습이 같은 숫자에 들어갑니다.
 *
 *   「지난주 75점 → 이번 주 82점」
 *
 * 이게 **실력이 는 것인지 쉬운 걸 골라 푼 것인지 구분할 방법이 없습니다.**
 * 리포트에서 가장 크게 뜨는 숫자가 가장 못 믿을 숫자였습니다.
 *
 * 그래서 **과목 × 방식**으로 갈라서 셉니다. 한 줄 안에서는 견줄 만한 것끼리만 견줍니다.
 * 갈래가 넷이지만 **기록이 있는 갈래만** 화면에 나가므로, 실제로는 한둘입니다.
 *
 * 난이도(단계)까지는 아직 못 가릅니다 — attempts 에 어느 세트였는지는 남지만
 * 「lv3 이 lv12 보다 쉽다」를 셈에 넣으려면 단계별 기준이 필요합니다.
 * 지금은 **거짓말을 안 하는 데까지**가 목표입니다.
 */

export interface TrackAttempt {
  module: Module;
  mode: Mode;
  score: number;
  /** 한국 기준 그 주의 월요일(YYYY-MM-DD) */
  weekStart: string;
}

export interface TrackWeek {
  label: string;
  /** 그 주에 기록이 없으면 null. 0점과 다릅니다 */
  average: number | null;
  count: number;
}

export interface Track {
  key: string;
  label: string;
  /** 오래된 주 → 이번 주 */
  weeks: TrackWeek[];
  /** 이 갈래의 전체 세션 수. 0이면 화면에 내지 않습니다 */
  total: number;
}

/**
 * 갈래는 **과목 × 방식**입니다.
 *
 * 시험을 앞에 둡니다. 연습은 몇 번이든 다시 할 수 있어서
 * 「지금 얼마나 아는가」는 시험 쪽이 더 정직하게 말해 줍니다.
 */
export const TRACKS: Array<{ key: string; label: string; module: Module; mode: Mode }> = [
  { key: 'dictation-exam', label: '받아쓰기 시험', module: 'dictation', mode: 'exam' },
  { key: 'spelling-exam', label: '맞춤법 시험', module: 'spelling', mode: 'exam' },
  { key: 'dictation-practice', label: '받아쓰기 연습', module: 'dictation', mode: 'practice' },
  { key: 'spelling-practice', label: '맞춤법 연습', module: 'spelling', mode: 'practice' },
];

/**
 * 갈래별로 주간 평균을 냅니다.
 *
 * @param weekStarts 오래된 주 → 이번 주 순서의 월요일 날짜들
 * @param labels     같은 순서의 화면 표시 이름
 */
export function buildTracks(
  attempts: TrackAttempt[],
  weekStarts: string[],
  labels: string[],
): Track[] {
  return TRACKS.map((track) => {
    const mine = attempts.filter((a) => a.module === track.module && a.mode === track.mode);

    const weeks = weekStarts.map((start, i) => {
      const bucket = mine.filter((a) => a.weekStart === start);
      return {
        label: labels[i] ?? start,
        // 기록이 없으면 null 입니다. 0점으로 두면 「0점을 받았다」로 읽힙니다.
        average:
          bucket.length === 0
            ? null
            : Math.round(bucket.reduce((sum, a) => sum + a.score, 0) / bucket.length),
        count: bucket.length,
      };
    });

    return { key: track.key, label: track.label, weeks, total: mine.length };
  }).filter((t) => t.total > 0);
}

/**
 * 이번 주가 며칠째인가 (월요일이 1일째, 일요일이 7일째).
 *
 * 「연습한 날 3일」만 보여 주면 수요일의 3일과 일요일의 3일이 같아 보입니다.
 * 앞의 것은 하루도 안 빠진 것이고 뒤의 것은 나흘을 쉰 것인데요.
 *
 * 날짜 문자열로만 셉니다(YYYY-MM-DD). 시간대는 부르는 쪽이 이미 서울로 맞춰 줍니다.
 */
export function daysIntoWeek(todayKey: string, weekStartKey: string): number {
  const day = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const diff = Math.round((day(todayKey) - day(weekStartKey)) / 86_400_000);
  // 주 밖의 값이 들어와도 화면이 이상해지지 않게 잘라 둡니다.
  return Math.min(7, Math.max(1, diff + 1));
}
