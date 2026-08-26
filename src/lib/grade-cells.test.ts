import { describe, expect, it } from 'vitest';
import { toGradeCells, toGradeRows, type GradeCell } from './grade-cells';
import { grade } from './grading';
import { WONGOJI_COLS, toCells } from './wongoji';

/**
 * 여기서 지킬 것은 하나입니다 —
 * **아이가 쓸 때 본 칸 수와 채점표의 칸 수가 같아야 합니다.**
 *
 * 다르면 바르게 쓰고도 「내가 뭘 잘못 썼지」 하고 칸을 세어 보게 됩니다.
 * 특히 쉼표 뒤가 그렇습니다. 원고지에서는 쉼표 뒤를 비우지 않는데
 * 채점에 넘기는 문장에는 공백이 있어서, 그냥 그리면 칸이 하나 더 생깁니다.
 */

/** 뜻이 있는 칸만 (줄을 채우는 pad 제외) */
function meaningful(cells: GradeCell[]): GradeCell[] {
  return cells.filter((c) => c.kind !== 'pad');
}

describe('맞게 썼을 때 — 쓰던 원고지와 칸 수가 같아야 한다', () => {
  const SENTENCES = [
    '콧잔등에 땀이 송골송골',
    '우유를 마시고, 빵도 먹어요.',
    '동생이 웃어요.',
    '정말 재미있니?',
    '"고마워." 하고 말했어요.',
    '호로록, 한 입 먹었어요.',
  ];

  for (const sentence of SENTENCES) {
    it(`「${sentence}」`, () => {
      const result = grade(sentence, sentence);
      expect(result.correct).toBe(true);

      const cells = meaningful(toGradeCells(result.columns));
      // toCells는 아이가 쓰는 화면이 정답을 그릴 때 쓰는 바로 그 함수입니다
      expect(cells.length).toBe(toCells(sentence).length);
    });
  }
});

describe('쉼표 뒤 — 원고지에서는 칸을 비우지 않는다', () => {
  it('쉼표 뒤 공백은 칸을 먹지 않는다', () => {
    const result = grade('가고, 나도', '가고, 나도');
    const cells = meaningful(toGradeCells(result.columns));
    // 가 고 , 나 도 = 다섯 칸. 쉼표 뒤 빈 칸이 있으면 여섯 칸이 됩니다.
    expect(cells.length).toBe(5);
    expect(cells.some((c) => c.kind === 'blank')).toBe(false);
  });

  it('마침표 뒤도 마찬가지', () => {
    const result = grade('가. 나', '가. 나');
    expect(meaningful(toGradeCells(result.columns)).length).toBe(3);
  });

  it('물음표 뒤는 비운다 — 원고지 규칙이 다릅니다', () => {
    const result = grade('가? 나', '가? 나');
    const cells = meaningful(toGradeCells(result.columns));
    expect(cells.length).toBe(4);
    expect(cells[2].kind).toBe('blank');
  });

  it('보통 띄어쓰기는 한 칸을 먹는다', () => {
    const result = grade('가나 다라', '가나 다라');
    const cells = meaningful(toGradeCells(result.columns));
    expect(cells.length).toBe(5);
    expect(cells[2].kind).toBe('blank');
  });

  it('쉼표를 두 번 찍어도 그 뒤 공백은 여전히 삼킨다', () => {
    // 아이가 더 쓴 글자는 정답 쪽 자리가 없으므로 「쉼표 뒤」라는 사실이 유지돼야 합니다
    const result = grade('가, 나', '가,, 나');
    const cells = meaningful(toGradeCells(result.columns));
    expect(cells.some((c) => c.kind === 'blank')).toBe(false);
    expect(cells.some((c) => c.kind === 'extra')).toBe(true);
  });
});

describe('띄어쓰기를 틀렸을 때', () => {
  it('띄어야 하는데 붙여 썼으면 ∨ 칸이 선다', () => {
    const result = grade('콧잔등에 땀이', '콧잔등에땀이');
    const cells = meaningful(toGradeCells(result.columns));
    const marks = cells.filter((c) => c.kind === 'needSpace');
    expect(marks.length).toBe(1);
    // 그 칸이 자리를 차지해야 뒤 글자들이 정답과 같은 세로줄에 섭니다
    expect(cells.length).toBe(toCells('콧잔등에 땀이').length);
  });

  it('붙여야 하는데 띄어 썼으면 ✕ 칸이 선다', () => {
    const result = grade('콧잔등에 땀이', '콧잔 등에 땀이');
    const cells = meaningful(toGradeCells(result.columns));
    expect(cells.filter((c) => c.kind === 'extraSpace').length).toBe(1);
  });
});

describe('글자를 빠뜨리거나 더 써도 세로줄이 안 어긋난다', () => {
  it('빠뜨린 글자는 빈 칸으로 자리를 지킨다', () => {
    const result = grade('가나다라', '가다라');
    const cells = meaningful(toGradeCells(result.columns));
    expect(cells.length).toBe(4);
    expect(cells.filter((c) => c.kind === 'missing').length).toBe(1);
  });

  it('더 쓴 글자도 제 칸을 갖는다', () => {
    const result = grade('가나다', '가나나다');
    const cells = meaningful(toGradeCells(result.columns));
    expect(cells.length).toBe(4);
    expect(cells.filter((c) => c.kind === 'extra').length).toBe(1);
  });
});

describe('줄 채우기 — 종이 원고지처럼', () => {
  it('마지막 줄을 15칸으로 채운다', () => {
    const result = grade('가나다', '가나다');
    const cells = toGradeCells(result.columns);
    expect(cells.length).toBe(WONGOJI_COLS);
    expect(cells.filter((c) => c.kind === 'pad').length).toBe(WONGOJI_COLS - 3);
  });

  it('15칸을 넘으면 다음 줄로 넘어가고 그 줄도 채운다', () => {
    const long = '가'.repeat(20);
    const cells = toGradeCells(grade(long, long).columns);
    expect(cells.length).toBe(WONGOJI_COLS * 2);
  });

  it('정확히 15칸이면 빈 줄을 더하지 않는다', () => {
    const exact = '가'.repeat(WONGOJI_COLS);
    const cells = toGradeCells(grade(exact, exact).columns);
    expect(cells.length).toBe(WONGOJI_COLS);
  });

  it('빈 답이어도 한 줄은 그린다', () => {
    expect(toGradeCells([]).length).toBe(WONGOJI_COLS);
  });
});

describe('toGradeRows — 줄로 끊기', () => {
  it('한 줄에 15칸씩', () => {
    const rows = toGradeRows(toGradeCells(grade('가'.repeat(20), '가'.repeat(20)).columns));
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.length === WONGOJI_COLS)).toBe(true);
  });

  it('끊어도 칸의 순서와 개수는 그대로', () => {
    const cells = toGradeCells(grade('콧잔등에 땀이 송골송골', '콧잔등에 땀이 송골송골').columns);
    expect(toGradeRows(cells).flat()).toEqual(cells);
  });
});

describe('내장 문제 전체 — 20단계를 뺀 모든 문장이 한 줄에 들어간다', () => {
  it('맞게 썼을 때 채점표도 한 줄(15칸)이어야 한다', async () => {
    const { DICTATION_BANK } = await import('@/data/dictation-bank');
    const overflow: string[] = [];

    for (const level of DICTATION_BANK) {
      // 20단계만 예외입니다 — 거기는 두 문장을 이어 받아쓰는 것이 목적입니다
      if (level.id === 'lv20') continue;
      for (const sentence of level.sentences) {
        const cells = toGradeCells(grade(sentence, sentence).columns);
        if (cells.length > WONGOJI_COLS) overflow.push(`${level.id}: ${sentence}`);
      }
    }

    expect(overflow).toEqual([]);
  });
});
