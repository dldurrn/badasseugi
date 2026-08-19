import { describe, it, expect } from 'vitest';
import { grade } from './grading';

/**
 * 속성 기반(무작위) 교차 검증.
 * 구체적 케이스가 아니라 "항상 성립해야 하는 성질"을 대량으로 확인합니다.
 */

function randomSyllable(): string {
  return String.fromCodePoint(0xac00 + Math.floor(Math.random() * 11172));
}

function randomSentence(): string {
  const words = 1 + Math.floor(Math.random() * 5);
  const parts: string[] = [];
  for (let w = 0; w < words; w++) {
    const len = 1 + Math.floor(Math.random() * 4);
    let s = '';
    for (let i = 0; i < len; i++) s += randomSyllable();
    parts.push(s);
  }
  let sentence = parts.join(' ');
  if (Math.random() < 0.5) sentence += ['.', '?', '!'][Math.floor(Math.random() * 3)];
  return sentence;
}

function mutate(s: string): string {
  const chars = Array.from(s);
  const op = Math.floor(Math.random() * 4);
  if (chars.length === 0) return s;
  const i = Math.floor(Math.random() * chars.length);
  switch (op) {
    case 0: chars.splice(i, 1); break;                      // 삭제
    case 1: chars.splice(i, 0, randomSyllable()); break;    // 삽입
    case 2: chars[i] = randomSyllable(); break;             // 치환
    case 3: chars.splice(i, 0, ' '); break;                 // 공백 삽입
  }
  return chars.join('');
}

describe('속성 기반 교차 검증 (무작위 2,000회)', () => {
  it('같은 문장은 항상 정답이고, 열은 정답 문장을 그대로 복원한다', () => {
    for (let n = 0; n < 1000; n++) {
      const s = randomSentence();
      const r = grade(s, s);
      expect(r.correct).toBe(true);
      expect(r.errorTypes).toEqual([]);
      const rebuilt = r.columns.map((c) => (c.kind === 'same' ? c.answer : '')).join('');
      expect(rebuilt).toBe(r.answer);
    }
  });

  it('변형된 문장은 오답이며, 열에서 입력과 정답이 모두 손실 없이 복원된다', () => {
    let checked = 0;
    for (let n = 0; n < 1000; n++) {
      const answer = randomSentence();
      const input = mutate(answer);
      const r = grade(answer, input);

      // 정규화 후 같아졌다면(공백만 바뀐 경우 등) 정답이어야 한다
      if (r.answer === r.input) {
        expect(r.correct).toBe(true);
        continue;
      }

      expect(r.correct).toBe(false);
      expect(r.errorTypes.length).toBeGreaterThan(0);

      const rebuiltInput = r.columns
        .map((c) => {
          if (c.kind === 'same' || c.kind === 'diff' || c.kind === 'extra') return c.input;
          if (c.kind === 'extraSpace') return ' ';
          return '';
        })
        .join('');
      const rebuiltAnswer = r.columns
        .map((c) => {
          if (c.kind === 'same' || c.kind === 'diff' || c.kind === 'missing') return c.answer;
          if (c.kind === 'needSpace') return ' ';
          return '';
        })
        .join('');

      expect(rebuiltInput).toBe(r.input);
      expect(rebuiltAnswer).toBe(r.answer);
      checked++;
    }
    expect(checked).toBeGreaterThan(500); // 실제로 충분히 검증되었는지 확인
  });

  it('오류 유형에 중복이 없다', () => {
    for (let n = 0; n < 500; n++) {
      const answer = randomSentence();
      const r = grade(answer, mutate(answer));
      expect(new Set(r.errorTypes).size).toBe(r.errorTypes.length);
    }
  });
});
