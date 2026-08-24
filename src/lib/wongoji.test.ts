import { describe, expect, it } from 'vitest';
import { DICTATION_BANK } from '@/data/dictation-bank';
import { normalize } from './hangul';
import {
  EMPTY,
  WONGOJI_COLS,
  WONGOJI_MIN_ROWS,
  growingGrid,
  padToGrid,
  toCells,
  toText,
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

  it('쓰는 중에는 한 줄을 미리 더 깔아 둔다', () => {
    const cells = toCells('가'.repeat(WONGOJI_COLS * 2));
    expect(growingGrid(cells).length).toBeGreaterThan(cells.length);
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
