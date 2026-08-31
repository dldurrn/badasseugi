import { describe, expect, it } from 'vitest';
import { type TrackAttempt, TRACKS, buildTracks, daysIntoWeek } from './report';
import { seoulWeekStart, toDateKeyInSeoul } from './review';

/**
 * 여기서 지킬 것 —
 * **견줄 수 없는 것을 견주지 않습니다.**
 *
 * 예전에는 받아쓰기 20단계 시험과 맞춤법 1단계 연습이 같은 평균에 들어갔습니다.
 * 그래서 「지난주 75 → 이번 주 82」가 실력이 는 것인지 쉬운 걸 고른 것인지
 * 알 수가 없었습니다. 리포트에서 가장 크게 뜨는 숫자가 가장 못 믿을 숫자였습니다.
 */

const 주 = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24'];
const 이름 = ['3주 전', '2주 전', '지난주', '이번 주'];

const a = (
  module: 'dictation' | 'spelling',
  mode: 'practice' | 'exam',
  score: number,
  weekStart: string,
): TrackAttempt => ({ module, mode, score, weekStart });

describe('갈래를 섞지 않는다', () => {
  it('과목과 방식이 다르면 다른 줄에 들어간다', () => {
    const tracks = buildTracks(
      [
        a('dictation', 'exam', 90, 주[3]),
        a('dictation', 'practice', 50, 주[3]),
        a('spelling', 'exam', 70, 주[3]),
      ],
      주,
      이름,
    );

    const 값 = Object.fromEntries(tracks.map((t) => [t.key, t.weeks[3].average]));
    expect(값).toEqual({
      'dictation-exam': 90,
      'dictation-practice': 50,
      'spelling-exam': 70,
    });
  });

  it('한 갈래 안에서만 평균을 낸다', () => {
    // 90과 70의 평균은 80. 다른 갈래의 50은 여기 안 섞입니다.
    const tracks = buildTracks(
      [
        a('dictation', 'exam', 90, 주[3]),
        a('dictation', 'exam', 70, 주[3]),
        a('spelling', 'practice', 50, 주[3]),
      ],
      주,
      이름,
    );
    const 시험 = tracks.find((t) => t.key === 'dictation-exam');
    expect(시험!.weeks[3].average).toBe(80);
    expect(시험!.weeks[3].count).toBe(2);
  });

  it('기록이 없는 갈래는 화면에 내지 않는다', () => {
    /*
      갈래가 넷이라 다 그리면 빈 줄이 셋입니다.
      빈 줄은 「0점」으로 오해되거나, 적어도 볼거리를 흐립니다.
    */
    const tracks = buildTracks([a('dictation', 'practice', 60, 주[3])], 주, 이름);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].key).toBe('dictation-practice');
  });

  it('아무 기록도 없으면 빈 목록', () => {
    expect(buildTracks([], 주, 이름)).toEqual([]);
  });

  it('시험이 연습보다 앞에 온다', () => {
    // 연습은 몇 번이든 다시 할 수 있어서, 「지금 얼마나 아는가」는 시험이 더 정직합니다.
    const tracks = buildTracks(
      [a('dictation', 'practice', 60, 주[3]), a('dictation', 'exam', 90, 주[3])],
      주,
      이름,
    );
    expect(tracks.map((t) => t.key)).toEqual(['dictation-exam', 'dictation-practice']);
  });
});

describe('기록 없는 주', () => {
  it('0점이 아니라 null 이다', () => {
    /*
      0으로 두면 화면에서 「0점을 받았다」로 읽힙니다.
      안 한 것과 못 한 것은 부모에게 완전히 다른 이야기입니다.
    */
    const tracks = buildTracks([a('dictation', 'exam', 90, 주[3])], 주, 이름);
    const weeks = tracks[0].weeks;
    expect(weeks.map((w) => w.average)).toEqual([null, null, null, 90]);
    expect(weeks.map((w) => w.count)).toEqual([0, 0, 0, 1]);
  });

  it('주 이름과 순서를 그대로 지킨다', () => {
    const tracks = buildTracks([a('dictation', 'exam', 90, 주[0])], 주, 이름);
    expect(tracks[0].weeks.map((w) => w.label)).toEqual(이름);
    // 3주 전 칸에 들어가야 합니다.
    expect(tracks[0].weeks[0].average).toBe(90);
  });
});

describe('갈래 정의', () => {
  it('과목 × 방식 넷이 모두 있다', () => {
    expect(TRACKS).toHaveLength(4);
    const keys = TRACKS.map((t) => `${t.module}-${t.mode}`);
    expect(new Set(keys).size).toBe(4);
  });

  it('key 가 겹치지 않는다', () => {
    expect(new Set(TRACKS.map((t) => t.key)).size).toBe(TRACKS.length);
  });
});

describe('이번 주가 며칠째인가', () => {
  it('월요일이 1일째, 일요일이 7일째', () => {
    // 2026-08-24 는 월요일입니다.
    expect(daysIntoWeek('2026-08-24', '2026-08-24')).toBe(1);
    expect(daysIntoWeek('2026-08-26', '2026-08-24')).toBe(3);
    expect(daysIntoWeek('2026-08-30', '2026-08-24')).toBe(7);
  });

  it('주 밖의 값이 들어와도 1~7 을 벗어나지 않는다', () => {
    // 화면이 「9일 중 3일」 같은 말을 하면 안 됩니다.
    expect(daysIntoWeek('2026-09-05', '2026-08-24')).toBe(7);
    expect(daysIntoWeek('2026-08-20', '2026-08-24')).toBe(1);
  });

  it('실제 날짜 헬퍼와 맞물린다', () => {
    // 오늘이 언제든 1~7 안이어야 합니다.
    const n = daysIntoWeek(toDateKeyInSeoul(), seoulWeekStart());
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(7);
  });

  it('달을 넘어가도 센다', () => {
    // 2026-08-31 은 월요일, 9월로 넘어갑니다.
    expect(daysIntoWeek('2026-09-02', '2026-08-31')).toBe(3);
  });
});
