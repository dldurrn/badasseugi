import { describe, expect, it } from 'vitest';
import { DICTATION_BANK } from '@/data/dictation-bank';
import { normalize } from './hangul';
import {
  EMPTY,
  cellToTextOffset,
  WONGOJI_COLS,
  WONGOJI_MIN_ROWS,
  growingGrid,
  padToGrid,
  toCells,
  toText,
  toWritingCells,
  writingCursor,
} from './wongoji';

/**
 * 여기서 지켜야 할 것은 하나입니다 — **왕복해도 문장이 그대로여야 합니다.**
 * 이게 깨지면 아이가 바르게 쓰고도 틀렸다는 채점을 받습니다.
 */

describe('toCells — 칸 규칙', () => {
  it('한 글자가 한 칸을 차지한다', () => {
    expect(toCells('가나다')).toEqual(['가', '나', '다']);
  });

  it('띄어쓰기는 빈 칸 하나', () => {
    expect(toCells('가 나')).toEqual(['가', EMPTY, '나']);
  });

  it('쉼표는 한 칸을 차지하고 뒤를 띄우지 않는다', () => {
    // 사진 속 1급 2번 문장
    expect(toCells('호로록, 한 입 먹으면')).toEqual([
      '호', '로', '록', ',', '한', EMPTY, '입', EMPTY, '먹', '으', '면',
    ]);
  });

  it('마침표도 뒤를 띄우지 않는다', () => {
    expect(toCells('쏟고, 묻히고, 깨뜨렸어.')).toEqual([
      '쏟', '고', ',', '묻', '히', '고', ',', '깨', '뜨', '렸', '어', '.',
    ]);
  });

  it('물음표 뒤는 원래 문장대로 한 칸 띄운다', () => {
    expect(toCells('정말? 그래.')).toEqual(['정', '말', '?', EMPTY, '그', '래', '.']);
  });

  it('문장 끝 물음표 뒤에는 빈 칸이 붙지 않는다', () => {
    // 사진 속 1급 4번 문장
    expect(toCells('할머니는 외롭지 않았을까?')).toEqual([
      '할', '머', '니', '는', EMPTY, '외', '롭', '지', EMPTY,
      '않', '았', '을', '까', '?',
    ]);
  });

  it('느낌표 뒤도 한 칸 띄운다', () => {
    expect(toCells('먼저 반갑게 인사해 봐!')).toEqual([
      '먼', '저', EMPTY, '반', '갑', '게', EMPTY, '인', '사', '해', EMPTY, '봐', '!',
    ]);
  });

  it('연속된 공백은 한 칸으로 본다', () => {
    expect(toCells('가  나')).toEqual(['가', EMPTY, '나']);
  });

  it('앞뒤 공백은 칸을 만들지 않는다', () => {
    expect(toCells('  가 나  ')).toEqual(['가', EMPTY, '나']);
  });
});

describe('toText — 문장으로 되돌리기', () => {
  it('빈 칸은 띄어쓰기가 된다', () => {
    expect(toText(['가', EMPTY, '나'])).toBe('가 나');
  });

  it('쉼표 뒤에 글자가 붙어 있으면 공백을 되살린다', () => {
    expect(toText(['호', '로', '록', ',', '한'])).toBe('호로록, 한');
  });

  it('쉼표 뒤에 아이가 한 칸을 띄웠어도 같은 문장이 된다', () => {
    // 원고지 규칙을 몰라도 채점이 달라지지 않아야 합니다.
    expect(toText(['호', '로', '록', ',', EMPTY, '한'])).toBe('호로록, 한');
  });

  it('문장 끝 마침표 뒤에는 공백을 붙이지 않는다', () => {
    expect(toText(['가', '.'])).toBe('가.');
  });

  it('아직 안 쓴 뒤쪽 빈 칸은 버린다', () => {
    expect(toText(['가', '나', EMPTY, EMPTY, EMPTY])).toBe('가나');
  });

  it('아무것도 안 쓰면 빈 문자열', () => {
    expect(toText([EMPTY, EMPTY, EMPTY])).toBe('');
  });
});

describe('왕복 — 내장 문제 전체', () => {
  const sentences = DICTATION_BANK.flatMap((set) => set.sentences);

  it('문제가 충분히 있다', () => {
    expect(sentences.length).toBeGreaterThan(150);
  });

  it('모든 문장이 칸으로 폈다가 되돌려도 그대로다', () => {
    const broken: string[] = [];

    for (const sentence of sentences) {
      const back = toText(toCells(sentence));
      if (back !== normalize(sentence)) broken.push(`${sentence} → ${back}`);
    }

    expect(broken).toEqual([]);
  });

  /**
   * 20급을 뺀 모든 문장은 원고지 한 줄에 들어가야 합니다.
   * 학교 문제지가 문장 하나에 한 줄이고, 두 줄이 되면 확인 버튼이 아래로 밀립니다.
   *
   * 20급만 예외입니다. 거기는 **두 문장을 이어 받아쓰는 것**이 목적이라
   * 칸에 맞추려고 줄이면 마지막 급수가 마지막 급수가 아니게 됩니다.
   */
  it('20급을 뺀 문장은 모두 한 줄에 들어간다', () => {
    const over: string[] = [];

    for (const set of DICTATION_BANK) {
      if (set.id === 'lv20') continue;
      for (const sentence of set.sentences) {
        const n = toCells(sentence).length;
        if (n > WONGOJI_COLS) over.push(`${set.name} ${n}칸 — ${sentence}`);
      }
    }

    expect(over).toEqual([]);
  });

  it('20급은 일부러 두 줄짜리를 둔다', () => {
    const lv20 = DICTATION_BANK.find((s) => s.id === 'lv20');
    const long = lv20!.sentences.filter((s) => toCells(s).length > WONGOJI_COLS);
    expect(long.length).toBeGreaterThan(0);
  });

  it('칸에 담기지 않는 문장이 없다', () => {
    for (const sentence of sentences) {
      expect(toCells(sentence).length).toBeLessThanOrEqual(
        WONGOJI_COLS * 14,
      );
    }
  });
});

describe('왕복 — 까다로운 문장', () => {
  const tricky = [
    '콧잔등에 땀이 송골송골',
    '눈처럼 하얗고 예쁜 집이',
    '고양이가 새끼를 낳았다.',
    '날마다 지쳐서 곯아떨어졌어.',
    '즐거운 일이 많이 생겼거든.',
    '뽀얗게 먼지 뒤집어쓴 채',
    '괜찮아, 다음에 잘하면 돼.',
    '네가 칭찬해 주니까 뿌듯해.',
    '"안녕?" 하고 물었다.',
    '어, 그래? 알았어!',
    '하나, 둘, 셋, 넷, 다섯',
    '점점 작아지더니…… 사라졌다.',
  ];

  for (const sentence of tricky) {
    it(`「${sentence}」`, () => {
      expect(toText(toCells(sentence))).toBe(normalize(sentence));
    });
  }
});

describe('쓰는 중의 칸 — 누른 대로 남는다', () => {
  it('띄어쓰기를 누르면 빈 칸이 생긴다', () => {
    // 예전에는 끝의 공백이 잘려서 스페이스가 안 먹는 것처럼 보였습니다.
    expect(toWritingCells('가 ')).toEqual(['가', EMPTY]);
    expect(writingCursor(toWritingCells('가 ').length, false)).toBe(2);
  });

  it('두 번 누르면 빈 칸도 두 개', () => {
    expect(toWritingCells('가  ')).toEqual(['가', EMPTY, EMPTY]);
  });

  it('쉼표 뒤 공백을 흡수하지 않는다', () => {
    expect(toWritingCells('호로록, ')).toEqual(['호', '로', '록', ',', EMPTY]);
  });

  it('쉼표를 붙여 써도 띄어 써도 같은 문장이 된다', () => {
    expect(toText(toWritingCells('호로록,한'))).toBe('호로록, 한');
    expect(toText(toWritingCells('호로록, 한'))).toBe('호로록, 한');
  });

  it('두 번 띄어 써도 채점 문장은 한 칸이다', () => {
    expect(normalize(toText(toWritingCells('가  나')))).toBe('가 나');
  });

  it('아무것도 안 쓰면 칸도 없다', () => {
    expect(toWritingCells('')).toEqual([]);
  });
});

describe('누른 칸 → 글자 자리', () => {
  const text = '눈처럼 하얗고 예쁜 집이';

  it('칸 번호와 글자 번호가 그대로 맞는다', () => {
    // 예전에는 격자를 눌러도 입력칸이 제 나름대로 커서를 잡아
    // 둘째 줄을 눌렀는데 첫째 줄 한가운데로 갔습니다.
    expect(cellToTextOffset(text, 0)).toBe(0);
    expect(cellToTextOffset(text, 3)).toBe(3);
    expect(cellToTextOffset(text, 7)).toBe(7);
    expect(cellToTextOffset(text, 11)).toBe(11);
  });

  it('누른 칸의 글자가 그 자리에 있다', () => {
    for (let i = 0; i < Array.from(text).length; i += 1) {
      expect(text[cellToTextOffset(text, i)]).toBe(Array.from(text)[i]);
    }
  });

  it('글자 끝을 넘겨 누르면 끝으로 붙는다', () => {
    // 빈 칸을 눌렀다고 공백을 채우면 그 공백이 그대로 답이 되어 채점이 틀어집니다.
    expect(cellToTextOffset(text, 40)).toBe(text.length);
    expect(cellToTextOffset('가나', 9)).toBe(2);
  });

  it('아무것도 안 쓴 격자를 눌러도 0', () => {
    expect(cellToTextOffset('', 7)).toBe(0);
  });

  it('음수가 들어와도 첫 칸으로 본다', () => {
    expect(cellToTextOffset(text, -3)).toBe(0);
  });

  it('두 자리를 차지하는 글자가 섞여도 어긋나지 않는다', () => {
    // 이모지는 UTF-16으로 두 자리입니다. 칸 번호를 그대로 쓰면 어긋납니다.
    const mixed = '가🐣나';
    expect(cellToTextOffset(mixed, 2)).toBe(3);
    expect(mixed.slice(cellToTextOffset(mixed, 2))).toBe('나');
  });
});

describe('커서 — 조합 중에는 쓰던 칸에 머문다', () => {
  it('아무것도 안 썼으면 첫 칸', () => {
    expect(writingCursor(0, false)).toBe(0);
  });

  it('「가」를 조합하는 중이면 커서는 그 「가」 칸에 있다', () => {
    // 예전에는 여기서 1을 돌려줘, 쓰고 있는 칸과 커서가 어긋났습니다.
    expect(writingCursor(toCells('가').length, true)).toBe(0);
  });

  it('글자가 확정되면 다음 칸으로 넘어간다', () => {
    expect(writingCursor(toCells('가').length, false)).toBe(1);
  });

  it('여러 글자를 쓴 뒤 조합 중이어도 마지막 칸에 머문다', () => {
    expect(writingCursor(toCells('눈처럼 하').length, true)).toBe(4);
    expect(writingCursor(toCells('눈처럼 하').length, false)).toBe(5);
  });

  it('조합 중인데 아직 글자가 없으면 첫 칸에 머문다', () => {
    expect(writingCursor(0, true)).toBe(0);
  });
});

describe('격자 만들기', () => {
  it('짧은 문장도 늘 같은 크기로 깐다', () => {
    // 칸 수가 곧 글자 수가 되면 정답을 알려주는 셈입니다.
    const short = padToGrid(toCells('가'));
    const long = padToGrid(toCells('가나다라마바사아자차카타파하'));
    expect(short.length).toBe(WONGOJI_COLS * WONGOJI_MIN_ROWS);
    expect(long.length).toBe(WONGOJI_COLS * WONGOJI_MIN_ROWS);
  });

  it('넘치면 줄이 늘어난다', () => {
    const cells = toCells('가'.repeat(WONGOJI_COLS * 5));
    expect(padToGrid(cells).length).toBe(WONGOJI_COLS * 5);
  });

  it('쓰기 전에는 한 줄만 깔아 둔다', () => {
    expect(growingGrid([]).length).toBe(WONGOJI_COLS);
  });

  it('한 줄이 아직 안 찼으면 줄이 늘지 않는다', () => {
    expect(growingGrid(toCells('가나다')).length).toBe(WONGOJI_COLS);
  });

  it('한 줄을 다 채우면 다음 줄이 생긴다', () => {
    const full = toCells('가'.repeat(WONGOJI_COLS));
    expect(full.length).toBe(WONGOJI_COLS);
    expect(growingGrid(full).length).toBe(WONGOJI_COLS * 2);
  });

  it('두 줄째를 쓰는 중에는 세 줄이 되지 않는다', () => {
    const cells = toCells('가'.repeat(WONGOJI_COLS + 3));
    expect(growingGrid(cells).length).toBe(WONGOJI_COLS * 2);
  });

  it('격자에 담아도 문장은 그대로다', () => {
    const sentence = '눈처럼 하얗고 예쁜 집이';
    expect(toText(padToGrid(toCells(sentence)))).toBe(sentence);
  });
});

describe('따옴표 — 마침표 뒤에 닫는 따옴표가 오는 경우', () => {
  it('마침표와 닫는 따옴표 사이가 벌어지지 않는다', () => {
    expect(toText(toCells('"고마워." 하고 말했어요.'))).toBe('"고마워." 하고 말했어요.');
  });

  it('여는 따옴표 앞 띄어쓰기는 그대로 남는다', () => {
    expect(toText(toCells('그가 "안녕" 했어요.'))).toBe('그가 "안녕" 했어요.');
  });
});
