import { describe, it, expect } from 'vitest';
import { SPELLING_BANK, pickBalanced, pickQuestions } from './spelling-bank';

describe('맞춤법 문제은행 무결성', () => {
  it('id가 중복되지 않는다', () => {
    const ids = SPELLING_BANK.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('정답은 항상 보기 안에 있다', () => {
    for (const q of SPELLING_BANK) {
      expect(q.options, `${q.id}의 보기에 정답이 없음`).toContain(q.answer);
    }
  });

  it('보기는 2개 이상이고 중복이 없다', () => {
    for (const q of SPELLING_BANK) {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
      expect(new Set(q.options).size, `${q.id} 보기 중복`).toBe(q.options.length);
    }
  });

  it('모든 문제에 설명과 태그가 있다', () => {
    for (const q of SPELLING_BANK) {
      expect(q.explanation.trim().length, q.id).toBeGreaterThan(0);
      expect(q.tag.trim().length, q.id).toBeGreaterThan(0);
      expect(q.prompt.trim().length, q.id).toBeGreaterThan(0);
    }
  });

  it('빈칸 문제에는 빈칸 표시가 있다', () => {
    for (const q of SPELLING_BANK.filter((x) => x.kind === 'fill' || x.kind === 'mcq')) {
      expect(q.prompt, `${q.id}에 ___ 없음`).toContain('___');
    }
  });

  it('찾기 문제의 보기를 이으면 원래 문장이 된다', () => {
    for (const q of SPELLING_BANK.filter((x) => x.kind === 'find')) {
      expect(q.options.join(' '), `${q.id} 문장 불일치`).toBe(q.prompt);
    }
  });

  it('찾기 문제는 바르게 고친 표기(correction)를 반드시 갖는다', () => {
    // find에서 answer는 "무엇이 틀렸는지"이지 "바른 표기"가 아닙니다.
    // correction이 없으면 맞혀도 정답이 뭔지 알려줄 방법이 없습니다.
    for (const q of SPELLING_BANK.filter((x) => x.kind === 'find')) {
      expect(q.correction, `${q.id}에 correction 없음`).toBeTruthy();
      expect(q.correction, `${q.id}의 correction이 answer와 같음`).not.toBe(q.answer);
    }
  });

  it('찾기가 아닌 문제는 correction을 따로 두지 않는다', () => {
    // mcq·fill은 answer 자체가 이미 바른 표기라 correction이 필요 없습니다.
    // 붙어 있으면 둘 중 뭘 믿어야 할지 헷갈립니다.
    for (const q of SPELLING_BANK.filter((x) => x.kind !== 'find')) {
      expect(q.correction, `${q.id}에 불필요한 correction`).toBeUndefined();
    }
  });

  it('세 유형 모두 충분한 문항을 갖는다', () => {
    for (const kind of ['mcq', 'fill', 'find'] as const) {
      const n = SPELLING_BANK.filter((q) => q.kind === kind).length;
      expect(n, `${kind} 문항 부족`).toBeGreaterThanOrEqual(5);
    }
  });

  it('난이도는 정해진 값 중 하나다', () => {
    for (const q of SPELLING_BANK) {
      expect(['basic', 'inter', 'advanced'], q.id).toContain(q.level);
    }
  });

  it('세 난이도 모두 문항이 있다', () => {
    for (const level of ['basic', 'inter', 'advanced'] as const) {
      const n = SPELLING_BANK.filter((q) => q.level === level).length;
      expect(n, `${level} 문항 부족`).toBeGreaterThan(0);
    }
  });

  it('보기가 완전히 같은 문항이 중복으로 들어 있지 않다', () => {
    // id는 다르지만 실수로 같은 문제를 두 번 넣는 경우를 잡습니다.
    const signatures = SPELLING_BANK.map((q) => `${q.kind}:${q.prompt}`);
    expect(new Set(signatures).size, '중복된 문제').toBe(signatures.length);
  });
});

describe('pickQuestions', () => {
  it('요청한 유형만 반환한다', () => {
    for (const kind of ['mcq', 'fill', 'find'] as const) {
      expect(pickQuestions(kind, 5).every((q) => q.kind === kind)).toBe(true);
    }
  });

  it('요청 개수를 넘지 않고, 풀보다 많이 요청하면 있는 만큼만 준다', () => {
    expect(pickQuestions('find', 3)).toHaveLength(3);
    const all = pickQuestions('find', 999);
    expect(all.length).toBe(SPELLING_BANK.filter((q) => q.kind === 'find').length);
  });

  it('반환된 문제에 중복이 없다', () => {
    const picked = pickQuestions('mcq', 99);
    expect(new Set(picked.map((q) => q.id)).size).toBe(picked.length);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const before = SPELLING_BANK.map((q) => q.id).join(',');
    pickQuestions('mcq', 10);
    expect(SPELLING_BANK.map((q) => q.id).join(',')).toBe(before);
  });
});

describe('pickBalanced', () => {
  it('요청한 개수만큼 돌려준다', () => {
    // mcq 47문항 전체를 대상으로 10개를 요청하면 10개가 나와야 합니다.
    expect(pickBalanced('mcq', 10)).toHaveLength(10);
  });

  it('고급 문항이 과반을 넘지 않는다 — 백 번 뽑아도 마찬가지다', () => {
    // 완전 무작위였다면 이 조건이 자주 깨집니다. 확률에 기대지 않고
    // 100번을 뽑아 매번 확인해서, 우연히 통과하는 것이 아님을 보장합니다.
    for (let i = 0; i < 100; i++) {
      const picked = pickBalanced('mcq', 10);
      const advanced = picked.filter((q) => q.level === 'advanced').length;
      expect(advanced, `advanced ${advanced}/10`).toBeLessThanOrEqual(5);
    }
  });

  it('문항이 부족한 유형이라도 요청 개수를 넘지 않는다', () => {
    const picked = pickBalanced('fill', 10);
    expect(picked.length).toBeLessThanOrEqual(10);
    expect(new Set(picked.map((q) => q.id)).size).toBe(picked.length);
  });
});
