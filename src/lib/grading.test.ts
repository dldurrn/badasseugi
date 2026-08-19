import { describe, it, expect } from 'vitest';
import { align, grade, scoreOf, type ErrorType } from './grading';
import { decompose, compose, spellOut, normalize } from './hangul';

/** 테스트 가독성을 위한 헬퍼 */
const types = (a: string, b: string): ErrorType[] => grade(a, b).errorTypes;
const isCorrect = (a: string, b: string) => grade(a, b).correct;

describe('hangul: 자모 분해·조합', () => {
  it('음절을 초성·중성·종성으로 분해한다', () => {
    expect(decompose('갔')).toEqual({ cho: 'ㄱ', jung: 'ㅏ', jong: 'ㅆ' });
    expect(decompose('가')).toEqual({ cho: 'ㄱ', jung: 'ㅏ', jong: '' });
    expect(decompose('값')).toEqual({ cho: 'ㄱ', jung: 'ㅏ', jong: 'ㅄ' });
    expect(decompose('꽃')).toEqual({ cho: 'ㄲ', jung: 'ㅗ', jong: 'ㅊ' });
  });

  it('한글이 아니면 null을 반환한다', () => {
    expect(decompose('a')).toBeNull();
    expect(decompose('1')).toBeNull();
    expect(decompose('.')).toBeNull();
    expect(decompose('ㄱ')).toBeNull(); // 자모 단독은 음절이 아님
    expect(decompose('')).toBeNull();
  });

  it('분해한 결과를 다시 조합하면 원래 글자가 된다 (왕복 검증)', () => {
    // 전체 11,172자 모두 검증 — 인덱스 계산 오류를 확실히 잡는다
    for (let code = 0xac00; code <= 0xd7a3; code++) {
      const ch = String.fromCodePoint(code);
      const jamo = decompose(ch);
      expect(jamo).not.toBeNull();
      expect(compose(jamo!)).toBe(ch);
    }
  });

  it('학습용 자모 표기를 만든다', () => {
    expect(spellOut('갔')).toBe('ㄱ + ㅏ + ㅆ');
    expect(spellOut('가')).toBe('ㄱ + ㅏ');
  });

  it('정규화: 앞뒤·중복 공백만 정리하고 문장부호는 남긴다', () => {
    expect(normalize('  오늘은   날씨가 맑다.  ')).toBe('오늘은 날씨가 맑다.');
    expect(normalize('안녕?')).toBe('안녕?');
  });
});

describe('align: 글자 정렬', () => {
  it('완전히 같으면 모두 eq', () => {
    const ops = align('가나다', '가나다');
    expect(ops.every((o) => o.type === 'eq')).toBe(true);
    expect(ops).toHaveLength(3);
  });

  it('한 글자 치환은 sub 하나로 정렬된다 (del+ins로 쪼개지지 않음)', () => {
    const ops = align('갔다', '같다');
    const subs = ops.filter((o) => o.type === 'sub');
    expect(subs).toHaveLength(1);
    expect(ops.filter((o) => o.type === 'del')).toHaveLength(0);
    expect(ops.filter((o) => o.type === 'ins')).toHaveLength(0);
  });

  it('정답에만 있는 글자는 del, 입력에만 있는 글자는 ins', () => {
    expect(align('사과나무', '사과무').filter((o) => o.type === 'del')).toHaveLength(1);
    expect(align('사과', '사과들').filter((o) => o.type === 'ins')).toHaveLength(1);
  });

  it('빈 문자열을 안전하게 처리한다', () => {
    expect(align('', '')).toEqual([]);
    expect(align('가', '')).toEqual([{ type: 'del', answer: '가' }]);
    expect(align('', '가')).toEqual([{ type: 'ins', input: '가' }]);
  });
});

describe('grade: 정답 판정', () => {
  it('완전히 일치하면 정답', () => {
    expect(isCorrect('오늘은 날씨가 맑습니다.', '오늘은 날씨가 맑습니다.')).toBe(true);
  });

  it('앞뒤·중복 공백 차이는 정답으로 인정한다', () => {
    expect(isCorrect('오늘은 날씨가 맑다.', '  오늘은  날씨가 맑다. ')).toBe(true);
  });

  it('정답일 때 오류 유형은 비어 있고 모든 열이 same이다', () => {
    const r = grade('학교에 갑니다.', '학교에 갑니다.');
    expect(r.errorTypes).toEqual([]);
    expect(r.columns.every((c) => c.kind === 'same')).toBe(true);
    expect(r.batchimDetails).toEqual([]);
  });

  it('문장부호가 빠지면 오답이다 (받아쓰기에서 부호는 채점 대상)', () => {
    expect(isCorrect('안녕하세요.', '안녕하세요')).toBe(false);
  });
});

describe('grade: 띄어쓰기 오류', () => {
  it('붙여 쓴 곳을 띄어쓰기 오류로 잡는다', () => {
    expect(types('오늘은 날씨가 맑다.', '오늘은날씨가 맑다.')).toEqual(['spacing']);
  });

  it('불필요하게 띄어 쓴 곳도 잡는다', () => {
    expect(types('맑습니다.', '맑 습니다.')).toEqual(['spacing']);
  });

  it('띄어쓰기만 틀렸을 때 글자 오류로 오분류되지 않는다', () => {
    const r = grade('어깨 동무한 두 사람', '어깨동무한 두사람');
    expect(r.errorTypes).toEqual(['spacing']);
    expect(r.columns.filter((c) => c.kind === 'needSpace')).toHaveLength(2);
    expect(r.columns.filter((c) => c.kind === 'diff')).toHaveLength(0);
    expect(r.columns.filter((c) => c.kind === 'missing')).toHaveLength(0);
  });

  it('띄어야 할 자리에 needSpace 열이 생긴다', () => {
    const r = grade('가 나', '가나');
    expect(r.columns.some((c) => c.kind === 'needSpace')).toBe(true);
  });

  it('붙여야 할 자리에 extraSpace 열이 생긴다', () => {
    const r = grade('가나', '가 나');
    expect(r.columns.some((c) => c.kind === 'extraSpace')).toBe(true);
  });
});

describe('grade: 받침 오류', () => {
  it('종성만 다르면 받침 오류로 분류한다', () => {
    expect(types('학교에 갔다.', '학교에 같다.')).toEqual(['batchim']);
  });

  it('겹받침 오류도 받침으로 잡는다', () => {
    expect(types('값이 싸다.', '갑이 싸다.')).toEqual(['batchim']);
    expect(types('날씨가 맑다.', '날씨가 막다.')).toEqual(['batchim']);
  });

  it('받침이 없는 글자에 받침을 붙인 경우도 잡는다', () => {
    expect(types('가다', '갇다')).toEqual(['batchim']);
  });

  it('받침 상세 정보를 정답·입력 쌍으로 제공한다', () => {
    const r = grade('학교에 갔다.', '학교에 같다.');
    expect(r.batchimDetails).toEqual([{ answer: '갔', input: '같' }]);
  });
});

describe('grade: 모음·자음 오류', () => {
  it('중성만 다르면 모음 오류 (애/에 혼동)', () => {
    expect(types('개', '게')).toEqual(['vowel']);
    expect(types('내가 왔다.', '네가 왔다.')).toEqual(['vowel']);
  });

  it('초성만 다르면 자음 오류 (된소리 혼동)', () => {
    expect(types('가치', '까치')).toEqual(['consonant']);
    expect(types('달', '탈')).toEqual(['consonant']);
  });

  it('두 부분 이상 다르면 일반 글자 오류로 분류한다', () => {
    expect(types('바다', '하늘')).toContain('letter');
  });
});

describe('grade: 복합 오류', () => {
  it('받침과 띄어쓰기가 함께 틀리면 둘 다 보고한다', () => {
    const t = types('친구와 함께 갔어요.', '친구와함께 같어요.');
    expect(t).toContain('spacing');
    expect(t).toContain('batchim');
  });

  it('오류 유형은 중복 없이 표시 우선순위대로 정렬된다', () => {
    const t = types('친구와 함께 갔어요.', '친구와함께 같어요.');
    expect(new Set(t).size).toBe(t.length); // 중복 없음
    expect(t.indexOf('batchim')).toBeLessThan(t.indexOf('spacing')); // 받침 먼저
  });

  it('글자를 빠뜨리면 missing 열이 생긴다', () => {
    const r = grade('사과나무', '사과무');
    expect(r.columns.some((c) => c.kind === 'missing')).toBe(true);
  });

  it('글자를 더 쓰면 extra 열이 생긴다', () => {
    const r = grade('사과', '사과들');
    expect(r.columns.some((c) => c.kind === 'extra')).toBe(true);
  });
});

describe('grade: 경계 조건', () => {
  it('빈 입력은 오답이며 앱이 죽지 않는다', () => {
    const r = grade('안녕하세요.', '');
    expect(r.correct).toBe(false);
    expect(r.columns.length).toBeGreaterThan(0);
  });

  it('공백만 입력해도 안전하다', () => {
    expect(grade('안녕.', '   ').correct).toBe(false);
  });

  it('정답이 비어 있어도 죽지 않는다', () => {
    expect(() => grade('', '무언가')).not.toThrow();
  });

  it('null/undefined가 들어와도 죽지 않는다', () => {
    // 런타임 방어 확인 (타입상으로는 들어올 수 없지만 DB 값이 null일 수 있음)
    expect(() =>
      grade(undefined as unknown as string, null as unknown as string),
    ).not.toThrow();
  });

  it('긴 문장도 정상 처리한다', () => {
    const long = '오늘은 아침부터 날씨가 무척 맑아서 친구들과 함께 운동장에서 신나게 뛰어놀았습니다.';
    expect(grade(long, long).correct).toBe(true);
    expect(grade(long, long.replace('맑아서', '막아서')).errorTypes).toEqual(['batchim']);
  });

  it('숫자와 영문이 섞여도 처리한다', () => {
    expect(isCorrect('나는 7살이다.', '나는 7살이다.')).toBe(true);
    expect(isCorrect('나는 7살이다.', '나는 8살이다.')).toBe(false);
  });

  it('열 배열은 항상 입력·정답을 모두 표현한다', () => {
    // 모든 열의 input 조각을 이으면 입력 문장이 복원되어야 한다
    const r = grade('어깨 동무한 두 사람', '어깨동무한 두사람');
    const reconstructedInput = r.columns
      .map((c) => {
        if (c.kind === 'same' || c.kind === 'diff') return c.input;
        if (c.kind === 'extra') return c.input;
        if (c.kind === 'extraSpace') return ' ';
        return '';
      })
      .join('');
    expect(reconstructedInput).toBe(r.input);

    const reconstructedAnswer = r.columns
      .map((c) => {
        if (c.kind === 'same' || c.kind === 'diff') return c.answer;
        if (c.kind === 'missing') return c.answer;
        if (c.kind === 'needSpace') return ' ';
        return '';
      })
      .join('');
    expect(reconstructedAnswer).toBe(r.answer);
  });
});

describe('scoreOf: 점수 계산', () => {
  it('전부 맞으면 100점', () => {
    expect(scoreOf([{ correct: true }, { correct: true }])).toBe(100);
  });

  it('전부 틀리면 0점', () => {
    expect(scoreOf([{ correct: false }, { correct: false }])).toBe(0);
  });

  it('반올림한다', () => {
    expect(scoreOf([{ correct: true }, { correct: false }, { correct: false }])).toBe(33);
    expect(scoreOf([{ correct: true }, { correct: true }, { correct: false }])).toBe(67);
  });

  it('빈 배열은 0점 (0으로 나누지 않음)', () => {
    expect(scoreOf([])).toBe(0);
  });

  it('12문제 중 1개 틀리면 92점 (은빛 배지 경계)', () => {
    const rs = Array.from({ length: 12 }, (_, i) => ({ correct: i !== 0 }));
    expect(scoreOf(rs)).toBe(92);
  });
});
