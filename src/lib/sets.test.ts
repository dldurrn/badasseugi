import { describe, expect, it } from 'vitest';
import { MAX_SENTENCES, normalizeSentences, normalizeSetName, suggestSetName } from './sets';
import { seoulWeekStart, toDateKeyInSeoul } from './review';

describe('normalizeSetName', () => {
  it('앞뒤 공백을 없애고 연속 공백을 하나로 만든다', () => {
    expect(normalizeSetName('  3월  둘째 주 ')).toBe('3월 둘째 주');
  });

  it('비어 있거나 너무 길면 거절한다', () => {
    expect(normalizeSetName('')).toBeNull();
    expect(normalizeSetName('   ')).toBeNull();
    expect(normalizeSetName('가'.repeat(61))).toBeNull();
    expect(normalizeSetName(123)).toBeNull();
  });
});

describe('normalizeSentences', () => {
  it('빈 줄을 버리고 공백을 정리한다', () => {
    expect(normalizeSentences(['  오늘은  맑아요. ', '', '   ', '친구와 놀았어요.'])).toEqual([
      '오늘은 맑아요.',
      '친구와 놀았어요.',
    ]);
  });

  it('문장부호는 지우지 않는다 — 받아쓰기에서는 채점 대상이다', () => {
    expect(normalizeSentences(['어디에 갔니?'])).toEqual(['어디에 갔니?']);
  });

  it('개수 상한을 넘기지 않는다', () => {
    const many = Array.from({ length: 50 }, (_, i) => `문장 ${i}`);
    expect(normalizeSentences(many)).toHaveLength(MAX_SENTENCES);
  });

  it('배열이 아니면 빈 배열을 돌려준다', () => {
    expect(normalizeSentences('문장')).toEqual([]);
    expect(normalizeSentences(null)).toEqual([]);
  });

  it('채점 기준과 같은 정규화를 쓴다 (조합형 → 완성형)', () => {
    // 자모가 분리된 조합형으로 들어와도 저장은 완성형으로 통일되어야
    // 아이가 쓴 완성형 입력과 글자 단위로 맞춰집니다.
    const decomposed = '가'.normalize('NFD');
    expect(normalizeSentences([decomposed])).toEqual(['가']);
  });
});

describe('suggestSetName', () => {
  it('날짜가 들어간 이름을 만든다', () => {
    expect(suggestSetName(new Date(2026, 2, 9))).toBe('3월 9일 받아쓰기');
  });
});

describe('toDateKeyInSeoul', () => {
  it('UTC 자정 이후라도 한국 날짜로 센다', () => {
    // UTC 23:30 = 한국 다음 날 08:30. 아침에 푼 기록이 어제로 밀리면
    // "서로 다른 날 두 번" 규칙이 어긋납니다.
    expect(toDateKeyInSeoul(new Date('2026-08-15T23:30:00Z'))).toBe('2026-08-16');
  });

  it('한국 기준 같은 날은 같은 키가 된다', () => {
    const morning = toDateKeyInSeoul(new Date('2026-08-16T00:00:00Z')); // 09:00 KST
    const evening = toDateKeyInSeoul(new Date('2026-08-16T13:00:00Z')); // 22:00 KST
    expect(morning).toBe('2026-08-16');
    expect(evening).toBe('2026-08-16');
  });
});

describe('seoulWeekStart', () => {
  // 2026-08-17은 월요일, 2026-08-16은 일요일입니다.
  it('월요일은 그날 자신이 주의 시작', () => {
    expect(seoulWeekStart(new Date('2026-08-17T03:00:00Z'))).toBe('2026-08-17');
  });

  it('일요일은 지난 월요일이 주의 시작 — 달력 주와 같게', () => {
    expect(seoulWeekStart(new Date('2026-08-16T03:00:00Z'))).toBe('2026-08-10');
  });

  it('같은 주의 월요일과 일요일은 같은 키로 묶인다', () => {
    const mon = seoulWeekStart(new Date('2026-08-17T03:00:00Z'));
    const sun = seoulWeekStart(new Date('2026-08-23T14:00:00Z'));
    expect(mon).toBe(sun);
  });

  it('한국 시간으로 날짜가 넘어가는 시각을 기준으로 센다', () => {
    // UTC로는 일요일 23:30이지만 한국은 이미 월요일 08:30 → 새 주가 시작됨
    expect(seoulWeekStart(new Date('2026-08-16T23:30:00Z'))).toBe('2026-08-17');
  });
});
