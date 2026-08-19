import { describe, expect, it } from 'vitest';
import { DICTATION_BANK, findBuiltinSet, isBuiltinSetId } from './dictation-bank';
import { decompose, normalize } from '@/lib/hangul';

/**
 * 내장 문제의 무결성 검사.
 *
 * 문장이 곧 채점 기준이라 오타 하나가 그대로 오답 처리로 이어집니다.
 * 사람이 눈으로 읽어 잡기 어려운 것들을 여기서 걸러 냅니다.
 */

describe('내장 세트 구조', () => {
  it('id가 겹치지 않는다', () => {
    const ids = DICTATION_BANK.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('id 형태가 내장 세트로 인식된다 — DB의 uuid와 섞이면 안 된다', () => {
    for (const set of DICTATION_BANK) {
      expect(isBuiltinSetId(set.id)).toBe(true);
    }
    expect(isBuiltinSetId('b5e52697-7514-4f79-914c-cd415bd2dae3')).toBe(false);
  });

  it('id가 급수와 맞다', () => {
    for (const set of DICTATION_BANK) {
      expect(set.id).toBe(`lv${set.level}`);
    }
  });

  it('급수가 1부터 순서대로, 빠짐없이 올라간다', () => {
    const levels = DICTATION_BANK.map((s) => s.level);
    expect(levels).toEqual(Array.from({ length: levels.length }, (_, i) => i + 1));
  });

  it('세트마다 문항이 10개씩 있다', () => {
    for (const set of DICTATION_BANK) {
      expect(set.sentences).toHaveLength(10);
    }
  });

  it('찾기가 동작한다', () => {
    expect(findBuiltinSet('lv1')?.level).toBe(1);
    expect(findBuiltinSet('없는id')).toBeNull();
  });
});

describe('문장 품질', () => {
  const all = DICTATION_BANK.flatMap((s) => s.sentences);

  it('한 세트 안에서 문항이 겹치지 않는다', () => {
    for (const set of DICTATION_BANK) {
      expect(new Set(set.sentences).size).toBe(set.sentences.length);
    }
  });

  it('앞뒤 공백이나 겹공백이 없다 — 저장된 그대로 채점 기준이 된다', () => {
    for (const sentence of all) {
      expect(sentence).toBe(normalize(sentence));
    }
  });

  it('빈 문항이 없고 너무 길지 않다', () => {
    for (const sentence of all) {
      expect(sentence.length).toBeGreaterThan(0);
      expect(sentence.length).toBeLessThanOrEqual(200);
    }
  });

  it('낱말 하나짜리 문항이 소리만으로 정답을 정할 수 없는 것은 아니다', () => {
    // ㅐ와 ㅔ는 발음이 합쳐져 어떤 음성으로 읽어도 귀로 구분할 수 없습니다.
    // "매미"처럼 한쪽 표기만 실제 낱말인 경우는 문제 없습니다 — [메미]로 쓸 아이가 없으니까요.
    // "우산 한 개"처럼 문맥이 있는 경우도 문제 없습니다 — "한 게"는 뜻이 안 통해 헷갈릴 일이 없습니다.
    //
    // 진짜 문제가 되는 건 **낱말 하나가 문항 전체이고, 그 낱말이 두 표기 모두 실제 낱말인 경우**입니다.
    // 개(강아지)/게(바닷게)를 낱말 하나만 듣고 쓰면 문맥이 없어 정답을 정할 수 없습니다.
    const ambiguous = ['개', '게', '새', '세', '배', '베', '매', '메'];
    for (const sentence of all) {
      if (sentence.includes(' ')) continue; // 여러 어절이면 문맥이 있어 안전합니다.
      expect(
        ambiguous.includes(sentence),
        `"${sentence}"은 낱말 하나뿐이라 소리가 같은 다른 낱말과 헷갈립니다`,
      ).toBe(false);
    }
  });

  it('1급은 받침이 없다 — 급수가 올라가며 어려워져야 한다', () => {
    const first = findBuiltinSet('lv1');
    for (const word of first!.sentences) {
      for (const ch of word) {
        const jamo = decompose(ch);
        if (!jamo) continue;
        expect(jamo.jong, `1급의 "${word}"에 받침이 있습니다`).toBe('');
      }
    }
  });

  it('2급부터는 받침 있는 낱말이 섞여 있다', () => {
    const second = findBuiltinSet('lv2');
    const hasBatchim = second!.sentences.some((word) =>
      [...word].some((ch) => decompose(ch)?.jong),
    );
    expect(hasBatchim).toBe(true);
  });

  it('6급은 짧은 문장으로 마침표가 있다', () => {
    const sixth = findBuiltinSet('lv6');
    for (const sentence of sixth!.sentences) {
      expect(sentence.endsWith('.')).toBe(true);
    }
  });

  it('10급은 문장부호가 다양하다 — 마침표만 있는 낮은 급과 달라야 한다', () => {
    const tenth = findBuiltinSet('lv10');
    const marks = new Set(
      tenth!.sentences.map((s) => s[s.length - 1]).filter((ch) => '.!?'.includes(ch)),
    );
    expect(marks.size).toBeGreaterThan(1);
  });
});
