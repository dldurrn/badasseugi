import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GOOGLE_VOICES,
  TYPECAST_VOICES,
  isBlocked,
  looksBlocked,
  markBlocked,
  matchVoice,
  pickEngines,
  type Engine,
} from './tts-engines';

/**
 * 여기서 지킬 것은 하나입니다 — **아이 화면에서 소리가 나야 합니다.**
 *
 * 한 회사가 막혀도 다른 키가 살아 있으면 그쪽으로 읽어야 하고,
 * 회사가 바뀌었다고 「남자 목소리」가 여자 목소리로 바뀌면 안 됩니다.
 * 실제로 타입캐스트가 403으로 막혔을 때 Google 키가 멀쩡한데도
 * 브라우저 내장 음성으로 떨어져 며칠을 그렇게 나갔습니다.
 */

const 원래환경 = { ...process.env };

beforeEach(() => {
  process.env.TYPECAST_API_KEY = 'test-typecast';
  process.env.GOOGLE_TTS_API_KEY = 'test-google';
  delete process.env.TTS_DAILY_LIMIT;
});

afterEach(() => {
  process.env = { ...원래환경 };
});

const 이름 = (list: Engine[]) => list.map((e) => e.name);

/*
  순서로 꺼내면 안 됩니다 — 막힌 회사는 뒤로 밀리기 때문에
  앞 테스트가 markBlocked를 부르면 순서가 뒤바뀝니다.
  (이 모듈의 「막힘」 기억은 테스트끼리도 이어집니다.)
*/
const 회사 = (name: Engine['name']): Engine => {
  const found = pickEngines().find((e) => e.name === name);
  if (!found) throw new Error(name + ' 회사를 못 찾았습니다');
  return found;
};

describe('pickEngines — 쓸 수 있는 회사를 좋아하는 순서로', () => {
  it('둘 다 키가 있으면 타입캐스트가 앞', () => {
    expect(이름(pickEngines())).toEqual(['typecast', 'google']);
  });

  it('타입캐스트 키를 지우면 Google만 — 되돌리기가 쉬워야 합니다', () => {
    delete process.env.TYPECAST_API_KEY;
    expect(이름(pickEngines())).toEqual(['google']);
  });

  it('키가 하나도 없으면 빈 목록 — 화면이 내장 음성으로 갑니다', () => {
    delete process.env.TYPECAST_API_KEY;
    delete process.env.GOOGLE_TTS_API_KEY;
    expect(pickEngines()).toEqual([]);
  });
});

describe('하루 한도 — 타입캐스트는 환경 변수로도 못 올린다', () => {
  it('아무것도 안 정하면 500자', () => {
    const typecast = 회사('typecast');
    expect(typecast.dailyLimit).toBe(500);
  });

  it('Google 기준(20,000)을 넣어도 타입캐스트는 500에서 멈춘다', () => {
    // 이게 바로 계정이 막힌 원인이었습니다.
    // 월 15,000자짜리 요금제에 하루 20,000자를 허용하고 있었습니다.
    process.env.TTS_DAILY_LIMIT = '20000';
    const typecast = 회사('typecast');
    expect(typecast.dailyLimit).toBe(500);
  });

  it('더 낮추는 것은 됩니다', () => {
    process.env.TTS_DAILY_LIMIT = '200';
    const typecast = 회사('typecast');
    expect(typecast.dailyLimit).toBe(200);
  });

  it('Google은 그 상한을 받지 않습니다 — 월 100만 자라 사정이 다릅니다', () => {
    delete process.env.TYPECAST_API_KEY;
    process.env.TTS_DAILY_LIMIT = '20000';
    const google = 회사('google');
    expect(google.dailyLimit).toBe(20000);
  });
});

describe('막힘 가려내기', () => {
  it('401·403은 막힌 것', () => {
    expect(looksBlocked(new Error('Typecast 403 UNUSUAL_ACTIVITY_DETECTED'))).toBe(true);
    expect(looksBlocked(new Error('Google 401 invalid key'))).toBe(true);
  });

  it('그 밖은 일시적 실패 — 잠가 버리면 잠깐 끊긴 걸로 남은 세션을 버립니다', () => {
    expect(looksBlocked(new Error('Typecast 500'))).toBe(false);
    expect(looksBlocked(new Error('fetch failed'))).toBe(false);
    expect(looksBlocked('그냥 글')).toBe(false);
    expect(looksBlocked(null)).toBe(false);
  });

  it('막힌 회사는 뒤로 밀리지만 목록에서 사라지지는 않는다', () => {
    markBlocked('typecast');
    expect(isBlocked('typecast')).toBe(true);
    // 둘 다 막혔을 수도 있으니 그래도 한 번은 던져 볼 수 있어야 합니다
    expect(이름(pickEngines())).toEqual(['google', 'typecast']);
  });
});

describe('matchVoice — 회사가 바뀌어도 남녀는 지킨다', () => {
  const typecast = () => 회사('typecast');
  const google = () => 회사('google');

  it('제 회사 목소리는 그대로 씁니다', () => {
    const id = TYPECAST_VOICES[0].id;
    expect(matchVoice(typecast(), id)).toBe(id);
  });

  it('타입캐스트 남자 → Google 남자', () => {
    const 타입캐스트남자 = TYPECAST_VOICES.find((v) => v.gender === 'MALE')!.id;
    const Google남자 = GOOGLE_VOICES.find((v) => v.gender === 'MALE')!.id;
    expect(matchVoice(google(), 타입캐스트남자)).toBe(Google남자);
  });

  it('Google 여자 → 타입캐스트 여자', () => {
    const Google여자 = GOOGLE_VOICES.find((v) => v.gender === 'FEMALE')!.id;
    const 타입캐스트여자 = TYPECAST_VOICES.find((v) => v.gender === 'FEMALE')!.id;
    expect(matchVoice(typecast(), Google여자)).toBe(타입캐스트여자);
  });

  it('모르는 이름이면 기본 목소리', () => {
    expect(matchVoice(google(), 'ko-KR-없는목소리')).toBe(google().defaultVoice);
    expect(matchVoice(google(), '')).toBe(google().defaultVoice);
    expect(matchVoice(google(), null)).toBe(google().defaultVoice);
    expect(matchVoice(google(), 42)).toBe(google().defaultVoice);
  });
});

describe('목소리 목록 — 회사가 바뀌어도 설정 화면이 같아 보여야 한다', () => {
  it('두 회사 모두 여자·남자 하나씩', () => {
    for (const list of [TYPECAST_VOICES, GOOGLE_VOICES]) {
      expect(list.length).toBe(2);
      expect(list.map((v) => v.gender).sort()).toEqual(['FEMALE', 'MALE']);
      expect(list.map((v) => v.name)).toEqual(['여자 목소리', '남자 목소리']);
    }
  });

  it('각 회사의 기본 목소리는 제 목록 안에 있다', () => {
    const typecast = 회사('typecast'), google = 회사('google');
    expect(TYPECAST_VOICES.some((v) => v.id === typecast.defaultVoice)).toBe(true);
    expect(GOOGLE_VOICES.some((v) => v.id === google.defaultVoice)).toBe(true);
  });

  it('목록의 이름이 그 회사의 형태를 지킨다', () => {
    const typecast = 회사('typecast'), google = 회사('google');
    for (const v of TYPECAST_VOICES) expect(typecast.voicePattern.test(v.id)).toBe(true);
    for (const v of GOOGLE_VOICES) expect(google.voicePattern.test(v.id)).toBe(true);
  });
});
