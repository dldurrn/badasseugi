import { describe, expect, it } from 'vitest';
import type { ItemOutcome } from './review';
import { buildWrongEvents } from './wrong-events';

/**
 * 여기서 지킬 것 —
 * **쌓인 줄은 안 바뀌고 안 지워집니다.**
 *
 * 오답노트는 문제마다 한 줄이라 계속 덮어써집니다. 그래서 리포트가
 * 나아짐을 못 보여 줬습니다. 이 표는 그 반대라, 무엇을 담고 무엇을 안 담는지가
 * 나중에 낼 수 있는 말을 통째로 정합니다.
 */

const 결과 = (over: Partial<ItemOutcome> = {}): ItemOutcome => ({
  module: 'dictation',
  refId: '닭이 울어요',
  content: '닭이 울어요',
  correct: false,
  errorTypes: ['batchim'],
  input: '닥이 울어요',
  ...over,
});

const 기본 = {
  childId: 'c1',
  attemptId: 'a1',
  module: 'dictation' as const,
  mode: 'exam' as const,
};

describe('틀린 것만 쌓는다', () => {
  it('맞힌 것은 한 줄도 안 남는다', () => {
    /*
      받아쓰기에서 오류 유형은 틀렸을 때만 생기고,
      분모(푼 문제 수)는 이미 attempts.total_count 에 있습니다.
      맞힌 것까지 저장할 까닭이 없습니다 — 아이 정보는 적을수록 좋습니다.
    */
    const rows = buildWrongEvents({
      ...기본,
      outcomes: [결과({ correct: true }), 결과({ correct: true, refId: '흙을 만졌어요' })],
    });
    expect(rows).toEqual([]);
  });

  it('틀린 것만 골라 낸다', () => {
    const rows = buildWrongEvents({
      ...기본,
      outcomes: [
        결과({ correct: true, refId: '맞힌 것' }),
        결과({ refId: '틀린 것' }),
        결과({ correct: true, refId: '또 맞힌 것' }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].ref_id).toBe('틀린 것');
  });

  it('아이가 쓴 것을 그대로 담는다', () => {
    // 「받침 8건」까지만 알고 어떻게 틀리는지 모르면 반쪽입니다.
    const rows = buildWrongEvents({ ...기본, outcomes: [결과()] });
    expect(rows[0].input).toBe('닥이 울어요');
    expect(rows[0].error_types).toEqual(['batchim']);
  });

  it('아이가 쓴 것이 없으면 null', () => {
    const rows = buildWrongEvents({ ...기본, outcomes: [결과({ input: undefined })] });
    expect(rows[0].input).toBeNull();
  });
});

describe('어느 세션이었나', () => {
  it('정규 세션이면 attempt 를 가리키고 source 가 session', () => {
    const rows = buildWrongEvents({ ...기본, outcomes: [결과()] });
    expect(rows[0].attempt_id).toBe('a1');
    expect(rows[0].source).toBe('session');
  });

  it('오답노트 복습이면 attempt 가 없고 source 가 review', () => {
    /*
      복습은 attempts 에 안 남아 분모가 없습니다.
      섞으면 「푼 문제 대비 오답률」이 부풀어 보입니다.
    */
    const rows = buildWrongEvents({ ...기본, attemptId: null, outcomes: [결과()] });
    expect(rows[0].attempt_id).toBeNull();
    expect(rows[0].source).toBe('review');
  });
});

describe('그때의 문제를 박아 둔다', () => {
  it('content 는 실제로 푼 문장이다', () => {
    /*
      받아쓰기는 ref_id 가 문장 원문이라, 부모가 세트를 고치면 옛 사건이 미아가 됩니다.
      짝 문제를 푼 것이면 짝 문장이 들어갑니다 — 그게 실제로 푼 것이니까요.
    */
    const rows = buildWrongEvents({
      ...기본,
      outcomes: [결과({ refId: '닭이 울어요', content: '흙을 만졌어요', wasTwin: true })],
    });
    expect(rows[0].ref_id).toBe('닭이 울어요');
    expect(rows[0].content).toBe('흙을 만졌어요');
  });
});

describe('길이를 넘지 않는다', () => {
  it('문장 상한(200자)에서 자른다', () => {
    const 긴것 = 'ㄱ'.repeat(500);
    const rows = buildWrongEvents({
      ...기본,
      outcomes: [결과({ refId: 긴것, content: 긴것, input: 긴것 })],
    });
    expect(rows[0].ref_id).toHaveLength(200);
    expect(rows[0].content).toHaveLength(200);
    expect(rows[0].input).toHaveLength(200);
  });

  it('오류 유형은 여덟 개까지', () => {
    const rows = buildWrongEvents({
      ...기본,
      outcomes: [결과({ errorTypes: Array.from({ length: 20 }, (_, i) => `t${i}`) })],
    });
    expect(rows[0].error_types).toHaveLength(8);
  });
});

describe('맞춤법도 같은 방식으로', () => {
  it('과목과 방식을 그대로 담는다', () => {
    const rows = buildWrongEvents({
      childId: 'c1',
      attemptId: 'a1',
      module: 'spelling',
      mode: 'practice',
      outcomes: [결과({ module: 'spelling', refId: 'dwae-1', errorTypes: ['되/돼'] })],
    });
    expect(rows[0].module).toBe('spelling');
    expect(rows[0].mode).toBe('practice');
    expect(rows[0].error_types).toEqual(['되/돼']);
  });
});
