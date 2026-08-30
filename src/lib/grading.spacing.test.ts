import { describe, expect, it } from 'vitest';
import { DICTATION_BANK } from '@/data/dictation-bank';
import { align, grade, type Column } from './grading';
import { toGradeCells } from './grade-cells';
import { compose, decompose } from './hangul';

/**
 * 여기서 지킬 것 —
 * **띄어쓰기 오류가 글자 오류로 둔갑하면 안 됩니다.**
 *
 * 실제로 그런 일이 있었습니다. 정답 「작은 발자국」에 아이가 「자근발자국」이라고 쓰자
 * 편집거리가 **공백을 「근」과 맞바꾸는** 길을 골랐습니다.
 *
 *   맞는 길   작→자(1)  은→근(1)  공백 지움(1)      = 3
 *   엉뚱한 길 작 지움(1) 은→자(1)  공백→근 맞바꿈(1) = 3   ← 동점, 대체 우선이라 이쪽
 *
 * 그래서 「자」가 「은」 밑에 놓여 위아래 견주기가 무너지고(절대 원칙 6),
 * ∨ 표식이 사라져 아이가 띄어쓰기를 틀렸다는 것조차 몰랐습니다.
 * 오류 유형도 `letter`로 적혀 오답노트·리포트·짝 문제까지 잘못 겨눴습니다.
 *
 * 고침은 `subCost` 하나입니다 — **공백은 글자와 맞바꿀 수 없습니다.**
 */

const 공백있는문장 = DICTATION_BANK.flatMap((l) => l.sentences).filter((s) => s.includes(' '));

/** 공백이 진짜 글자와 짝지어진 열. 하나라도 있으면 실패입니다. */
function 공백이글자와짝지어진열(columns: Column[]): Column[] {
  return columns.filter(
    (c) => c.kind === 'diff' && (c.input === ' ') !== (c.answer === ' '),
  );
}

/** n번째 한글 글자에 오타를 냅니다. 실제 아이가 내는 종류로만. */
function 오타내기(s: string, n: number, how: 'batchim' | 'vowel' | 'consonant'): string | null {
  const chars = [...s];
  const idx = chars.map((c, i) => [c, i] as const).filter(([c]) => decompose(c))[n]?.[1];
  if (idx === undefined) return null;
  const j = decompose(chars[idx])!;
  const next =
    how === 'batchim'
      ? compose({ ...j, jong: j.jong ? '' : 'ㄱ' })
      : how === 'vowel'
        ? compose({ ...j, jung: j.jung === 'ㅏ' ? 'ㅓ' : 'ㅏ' })
        : compose({ ...j, cho: j.cho === 'ㄱ' ? 'ㄴ' : 'ㄱ' });
  if (next === chars[idx]) return null;
  chars[idx] = next;
  return chars.join('');
}

/** 채점표를 사람이 읽는 두 줄로. 어긋남이 눈에 보여야 고칠 수 있습니다. */
function 두줄(answer: string, input: string): { 위: string; 아: string } {
  const 칸 = toGradeCells(grade(answer, input).columns).filter((c) => c.kind !== 'pad');
  return {
    위: 칸
      .map((c) =>
        c.kind === 'needSpace'
          ? '∨'
          : c.kind === 'extraSpace'
            ? '✕'
            : c.kind === 'blank'
              ? '_'
              : c.kind === 'missing'
                ? '·'
                : c.input,
      )
      .join(' '),
    아: 칸
      .map((c) =>
        c.kind === 'blank' || c.kind === 'needSpace'
          ? '_'
          : c.kind === 'extra' || c.kind === 'extraSpace'
            ? '·'
            : c.answer,
      )
      .join(' '),
  };
}

describe('실제로 났던 그 일', () => {
  it('「작은 발자국」에 「자근발자국」 — 글자끼리 짝지어지고 ∨ 가 뜬다', () => {
    const g = grade('작은 발자국', '자근발자국');
    expect(두줄('작은 발자국', '자근발자국')).toEqual({
      위: '자 근 ∨ 발 자 국',
      아: '작 은 _ 발 자 국',
    });
    // 받침(작→자), 자음(은→근), 띄어쓰기 셋 다 잡혀야 합니다.
    expect(g.errorTypes).toContain('batchim');
    expect(g.errorTypes).toContain('consonant');
    expect(g.errorTypes).toContain('spacing');
  });

  it('한 문장에 띄어쓰기를 두 군데 빠뜨려도 자리를 지킨다', () => {
    expect(두줄('우산 한 개', '우사한개')).toEqual({
      위: '우 사 ∨ 한 ∨ 개',
      아: '우 산 _ 한 _ 개',
    });
  });

  it('받침만 틀리면서 붙여 쓴 경우', () => {
    expect(두줄('파란 하늘', '파라하늘')).toEqual({
      위: '파 라 ∨ 하 늘',
      아: '파 란 _ 하 늘',
    });
  });
});

describe('공백은 글자와 맞바꿀 수 없다 — 내장 문장 전수 조사', () => {
  it('띄어쓰기 하나를 빠뜨리며 오타를 낸 모든 경우', () => {
    /*
      고치기 전에는 세 갈래 모두 589 중 132(22%)가 걸렸습니다.
      오타의 종류가 아니라 **오타가 공백 가까이 있는지**가 문제였습니다.
    */
    const 걸린것: string[] = [];
    for (const s of 공백있는문장) {
      for (let n = 0; n < 4; n += 1) {
        for (const how of ['batchim', 'vowel', 'consonant'] as const) {
          const 오타 = 오타내기(s, n, how);
          if (!오타) continue;
          const 입력 = 오타.replace(' ', '');
          if (공백이글자와짝지어진열(grade(s, 입력).columns).length > 0) {
            걸린것.push(`${s} ← ${입력}`);
          }
        }
      }
    }
    expect(걸린것).toEqual([]);
  });

  it('띄어쓰기를 전부 빠뜨리며 오타를 낸 경우', () => {
    const 걸린것: string[] = [];
    for (const s of 공백있는문장) {
      const 오타 = 오타내기(s, 0, 'batchim');
      if (!오타) continue;
      const 입력 = 오타.replace(/ /g, '');
      if (공백이글자와짝지어진열(grade(s, 입력).columns).length > 0) 걸린것.push(s);
    }
    expect(걸린것).toEqual([]);
  });

  it('없는 자리에 띄어쓰기를 넣으며 오타를 낸 경우', () => {
    const 걸린것: string[] = [];
    for (const s of 공백있는문장) {
      const 오타 = 오타내기(s, 0, 'vowel');
      if (!오타) continue;
      const 입력 = 오타.slice(0, 2) + ' ' + 오타.slice(2);
      if (공백이글자와짝지어진열(grade(s, 입력).columns).length > 0) 걸린것.push(s);
    }
    expect(걸린것).toEqual([]);
  });
});

describe('띄어쓰기를 틀렸으면 띄어쓰기라고 말한다', () => {
  it('공백을 빠뜨린 모든 경우에 유형으로 잡힌다', () => {
    /*
      이 값이 오답노트의 error_types 로 저장되고, 리포트의 「오답 유형」 막대가 되고,
      짝 문제가 무엇을 겨눌지도 정합니다. 여기서 틀리면 세 곳이 함께 틀립니다.
    */
    const 안잡힌것: string[] = [];
    for (const s of 공백있는문장) {
      for (const how of ['batchim', 'vowel', 'consonant'] as const) {
        const 오타 = 오타내기(s, 0, how);
        if (!오타) continue;
        const 입력 = 오타.replace(' ', '');
        if (!grade(s, 입력).errorTypes.includes('spacing')) 안잡힌것.push(`${s} ← ${입력}`);
      }
    }
    expect(안잡힌것).toEqual([]);
  });

  it('한 글자 어절도 지킨다 — 「안 돼!」 「몇 개예요?」', () => {
    // 한 글자 어절은 공백에 바로 붙어 있어 가장 잘 어긋나던 자리입니다.
    for (const [정답, 입력] of [
      ['안 돼!', '아돼!'],
      ['몇 개예요?', '며개예요?'],
      ['잘 먹겠습니다.', '자먹겠습니다.'],
      ['왜 그래요?', '왝그래요?'],
    ]) {
      const g = grade(정답, 입력);
      expect(g.errorTypes, `${정답} ← ${입력}`).toContain('spacing');
      expect(공백이글자와짝지어진열(g.columns), `${정답} ← ${입력}`).toEqual([]);
    }
  });
});

describe('망가뜨리지 않았다', () => {
  it('맞다/틀리다 판정은 손도 대지 않는다', () => {
    /*
      `grade()` 는 정렬을 하기 **전에** 문자열을 그대로 견주어 correct 를 정합니다.
      그러니 정렬을 아무리 바꿔도 점수는 흔들릴 수 없습니다. 그걸 여기서 못 박습니다.
    */
    const 전부 = DICTATION_BANK.flatMap((l) => l.sentences);
    for (const s of 전부) {
      expect(grade(s, s).correct, s).toBe(true);
      expect(grade(s, s + '틀림').correct, s).toBe(false);
      expect(grade(s, s.replace(/ /g, '')).correct, s).toBe(s === s.replace(/ /g, ''));
    }
  });

  it('열을 되짚으면 정답과 입력이 그대로 나온다', () => {
    // 정렬이 바뀌어도 **잃어버린 글자가 있으면 안 됩니다.**
    const 되살리기 = (columns: Column[]) => {
      let a = '';
      let b = '';
      for (const c of columns) {
        if (c.kind === 'same' || c.kind === 'diff') {
          a += c.answer;
          b += c.input;
        } else if (c.kind === 'missing') a += c.answer;
        else if (c.kind === 'extra') b += c.input;
        else if (c.kind === 'needSpace') a += ' ';
        else if (c.kind === 'extraSpace') b += ' ';
      }
      return { a, b };
    };

    for (const s of 공백있는문장) {
      for (const how of ['batchim', 'vowel', 'consonant'] as const) {
        const 오타 = 오타내기(s, 0, how);
        if (!오타) continue;
        const 입력 = 오타.replace(' ', '');
        const g = grade(s, 입력);
        expect(되살리기(g.columns), `${s} ← ${입력}`).toEqual({ a: g.answer, b: g.input });
      }
    }
  });

  it('글자 자리에 공백을 쓴 경우도 말이 되게 짚는다', () => {
    // 정답에 글자가 있는데 아이가 거기를 띄웠습니다. 「글자를 빠뜨리고 띄었다」가 맞습니다.
    const g = grade('가나다', '가 다');
    expect(g.errorTypes).toContain('spacing');
    expect(공백이글자와짝지어진열(g.columns)).toEqual([]);
  });

  it('공백이 없는 문장은 정렬이 하나도 안 바뀐다', () => {
    /*
      이 고침은 공백이 낀 자리에만 닿습니다.
      공백이 없으면 `subCost` 가 예전과 똑같이 0 또는 1을 돌려주므로
      한 글자짜리·붙여 쓴 문장의 채점은 그대로여야 합니다.
    */
    for (const [a, b] of [
      ['포도', '보도'],
      ['학교', '학꾜'],
      ['닭', '닥'],
      ['꽃', '꼿'],
    ]) {
      const ops = align(a, b);
      expect(ops.every((o) => o.type === 'eq' || o.type === 'sub'), `${a}/${b}`).toBe(true);
    }
  });
});
