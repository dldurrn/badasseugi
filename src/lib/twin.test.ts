import { describe, expect, it } from 'vitest';
import { SPELLING_BANK } from '@/data/spelling-bank';
import {
  MAX_TWIN_TRIES,
  chooseTwin,
  exercises,
  lengthOk,
  matchPunctuation,
  needsTwin,
  pickSpellingTwin,
  rejectTwin,
  stepOf,
} from './twin';
import { toCells, WONGOJI_COLS } from './wongoji';

/**
 * 여기서 지킬 것 —
 * **짝 문장이 아이의 별을 부당하게 앗아 가면 안 됩니다.**
 *
 * 짝은 AI 가 만들지만 아이는 그걸 모릅니다. 이상한 문장이 나오면
 * 아이는 자기가 틀렸다고 생각하고 별을 잃습니다.
 * 그래서 내장 문제은행에 걸어 둔 것과 **같은 기준**을 통과해야만 씁니다.
 */

describe('맞춤법 짝 — 문제은행에서 고른다', () => {
  it('같은 태그의 다른 문항을 고른다', () => {
    const 되돼 = SPELLING_BANK.filter((q) => q.tag === '되/돼');
    expect(되돼.length, '되/돼 문항이 둘 이상 있어야 짝을 낼 수 있습니다').toBeGreaterThan(1);

    const twin = pickSpellingTwin(['되/돼'], [되돼[0].id], () => 0);
    expect(twin).not.toBeNull();
    expect(twin!.tag).toBe('되/돼');
    expect(twin!.id).not.toBe(되돼[0].id);
  });

  it('원본을 짝으로 내지 않는다', () => {
    // 같은 것을 두 번 내면 애초에 고치려던 문제로 돌아갑니다.
    const 되돼 = SPELLING_BANK.filter((q) => q.tag === '되/돼');
    const 뺀것 = 되돼.map((q) => q.id);
    for (let i = 0; i < 되돼.length; i++) {
      const twin = pickSpellingTwin(['되/돼'], [되돼[0].id], () => i);
      expect(twin?.id).not.toBe(되돼[0].id);
    }
    // 전부 빼면 낼 것이 없습니다.
    expect(pickSpellingTwin(['되/돼'], 뺀것)).toBeNull();
  });

  it('이미 짝으로 냈던 것도 뺀다', () => {
    const 태그 = '되/돼';
    const 전부 = SPELLING_BANK.filter((q) => q.tag === 태그).map((q) => q.id);
    const twin = pickSpellingTwin([태그],전부.slice(1), () => 0);
    expect(twin?.id).toBe(전부[0]);
  });

  it('모르는 태그면 낼 것이 없다', () => {
    expect(pickSpellingTwin(['없는태그'], [])).toBeNull();
  });

  it('짝을 낼 수 없는 태그가 어떤 것인지 드러난다', () => {
    /*
      문항이 하나뿐인 태그는 짝을 낼 수 없습니다. 그때는 조용히 원본을 두 번 풉니다.
      막아야 할 것은 아니지만 **얼마나 되는지는 알고 있어야** 합니다 —
      절반이 그렇다면 문제은행을 채우는 편이 AI 보다 값어치가 큽니다.
    */
    const 태그별 = new Map<string, number>();
    for (const q of SPELLING_BANK) 태그별.set(q.tag, (태그별.get(q.tag) ?? 0) + 1);
    const 혼자인태그 = [...태그별.entries()].filter(([, n]) => n < 2);
    // 지금은 절반을 넘지 않아야 합니다.
    expect(혼자인태그.length).toBeLessThan(태그별.size / 2);
  });
});

describe('받아쓰기 짝 — AI 가 만든 것을 거른다', () => {
  const 받침 = ['batchim'] as const;

  it('원고지 한 줄을 넘으면 떨어뜨린다', () => {
    const 긴문장 = '아주 기다랗고 길어서 한 줄에 도저히 들어가지 않는 문장이에요';
    expect(toCells(긴문장).length).toBeGreaterThan(WONGOJI_COLS);
    expect(rejectTwin(긴문장, '닭이 울어요', [...받침])).toBe('too-long');
  });

  it('원본과 같으면 떨어뜨린다', () => {
    // 같은 문장을 두 번 내면 암기를 못 거릅니다. 짝을 두는 이유가 사라집니다.
    expect(rejectTwin('닭이 울어요', '닭이 울어요', [...받침])).toBe('same-as-origin');
  });

  it('문장부호와 공백만 다른 것도 같은 문장으로 본다', () => {
    expect(rejectTwin('닭이 울어요.', '닭이 울어요', [...받침])).toBe('same-as-origin');
    expect(rejectTwin('닭이울어요', '닭이 울어요', [...받침])).toBe('same-as-origin');
  });

  it('소리만으로 표기를 정할 수 없는 낱말은 떨어뜨린다', () => {
    /*
      ㅐ와 ㅔ는 어떤 목소리로 읽어도 귀로 구분할 수 없습니다.
      「개」와 「게」가 둘 다 실제 낱말이라, 낱말 하나만 내면 아이가 무엇을 써도
      정답이라 할 수 없습니다. 내장 문제은행이 지키는 것과 같은 기준입니다.
    */
    expect(rejectTwin('개', '닭', [])).toBe('ambiguous-sound');
    expect(rejectTwin('게', '닭', [])).toBe('ambiguous-sound');
    // 문맥이 있으면 안전합니다.
    expect(rejectTwin('개가 짖어요', '닭이 울어요', [])).toBeNull();
  });

  it('영어나 숫자가 섞이면 떨어뜨린다', () => {
    expect(rejectTwin('apple 을 먹어요', '닭이 울어요', [])).toBe('not-hangul');
    expect(rejectTwin('3시에 만나요', '닭이 울어요', [])).toBe('not-hangul');
  });

  it('빈 문장을 떨어뜨린다', () => {
    expect(rejectTwin('   ', '닭이 울어요', [])).toBe('empty');
  });

  it('겨눈 오류를 연습시키지 않으면 떨어뜨린다', () => {
    // 받침을 틀린 아이에게 받침 없는 문장을 내면 연습이 안 됩니다.
    expect(rejectTwin('아기가 자요', '닭이 울어요', [...받침])).toBe('missing-error-type');
    expect(rejectTwin('흙을 만졌어요', '닭이 울어요', [...받침])).toBeNull();
  });
});

describe('오류 유형을 정말 담고 있는가 — 채점기의 분해기를 그대로 쓴다', () => {
  it('받침', () => {
    expect(exercises('흙을 만졌어요', 'batchim')).toBe(true);
    expect(exercises('아기가 자요', 'batchim')).toBe(false);
  });

  it('모음', () => {
    expect(exercises('의사 선생님', 'vowel')).toBe(true);
    expect(exercises('나무가 크다', 'vowel')).toBe(false);
  });

  it('자음', () => {
    expect(exercises('꽃이 피었어요', 'consonant')).toBe(true);
    expect(exercises('나무가 자라요', 'consonant')).toBe(false);
  });

  it('문장부호', () => {
    expect(exercises('어디 가니?', 'punct')).toBe(true);
    expect(exercises('학교에 가요', 'punct')).toBe(false);
  });

  it('띄어쓰기 — 띄어쓸 자리가 하나라도 있어야 한다', () => {
    expect(exercises('나는 학교에 갑니다', 'spacing')).toBe(true);
    // 어절 둘이면 띄어쓸 자리가 하나 있습니다. 그걸로 충분합니다.
    expect(exercises('학교에 가요', 'spacing')).toBe(true);
    expect(exercises('학교', 'spacing')).toBe(false);
  });

  it('letter 는 볼 수 있는 것이 없어 통과시킨다', () => {
    /*
      「통째로 다른 글자」는 겨눌 자리가 정해져 있지 않습니다.
      뚫려도 잃는 것은 별 하나입니다 — 오답노트 풀이는 점수 기록에 안 들어갑니다.
    */
    expect(exercises('아무 문장', 'letter')).toBe(true);
  });
});

describe('후보 중에서 고르기', () => {
  it('통과한 첫 번째를 고른다', () => {
    const { sentence } = chooseTwin(
      ['닭이 울어요', '흙을 만졌어요', '여덟 시에 자요'],
      '닭이 울어요',
      ['batchim'],
    );
    expect(sentence).toBe('흙을 만졌어요');
  });

  it('왜 떨어졌는지 남긴다 — 프롬프트를 고칠 단서가 됩니다', () => {
    const { rejects } = chooseTwin(['닭이 울어요', '흙을 만졌어요'], '닭이 울어요', ['batchim']);
    expect(rejects).toEqual([{ sentence: '닭이 울어요', why: 'same-as-origin' }]);
  });

  it('하나도 통과 못 하면 null — 그때는 원본을 두 번 푼다', () => {
    const { sentence } = chooseTwin(['아기가 자요', '나무가 커요'], '닭이 울어요', ['batchim']);
    expect(sentence).toBeNull();
  });

  it('후보가 없어도 깨지지 않는다', () => {
    expect(chooseTwin([], '닭이 울어요', ['batchim']).sentence).toBeNull();
  });
});

describe('지금 몇 번째 걸음인가 — 칸을 따로 두지 않는다', () => {
  it('별이 없으면 원본', () => {
    expect(stepOf({ streak: 0, twinRef: '흙을 만졌어요' })).toBe('origin');
  });

  it('별 하나면 짝', () => {
    expect(stepOf({ streak: 1, twinRef: '흙을 만졌어요' })).toBe('twin');
  });

  it('짝이 없으면 언제나 원본 — 지금까지의 동작 그대로', () => {
    /*
      아직 못 만들었거나 만들다 실패한 경우입니다.
      아이 화면에는 아무 일도 일어나지 않고, 원본을 두 번 풀어 졸업합니다.
    */
    expect(stepOf({ streak: 0, twinRef: null })).toBe('origin');
    expect(stepOf({ streak: 1, twinRef: null })).toBe('origin');
  });
});

describe('짝을 만들어 볼 만한가', () => {
  const base = { twinRef: null, twinTries: 0, streak: 0 };

  it('없으면 만든다', () => {
    expect(needsTwin(base)).toBe(true);
  });

  it('이미 있으면 안 만든다', () => {
    expect(needsTwin({ ...base, twinRef: '흙을 만졌어요' })).toBe(false);
  });

  it('여러 번 실패했으면 그만둔다', () => {
    /*
      twin_ref 가 비어 있는 것만으로는 「아직 안 만들었음」과 「만들려다 실패했음」을
      가릴 수 없습니다. 그러면 오답노트를 열 때마다 될 리 없는 호출을 또 던집니다.
    */
    expect(needsTwin({ ...base, twinTries: MAX_TWIN_TRIES })).toBe(false);
    expect(needsTwin({ ...base, twinTries: MAX_TWIN_TRIES - 1 })).toBe(true);
  });

  it('졸업한 노트에는 안 만든다', () => {
    expect(needsTwin({ ...base, streak: 2 })).toBe(false);
  });
});

describe('난이도 — 짝은 원본과 비슷한 길이여야 한다', () => {
  it('낱말 하나를 틀린 아이에게 긴 문장을 내지 않는다', () => {
    /*
      실제로 처음 붙였을 때 「포도」(2칸)의 짝으로 「책을 읽었어요.」(8칸)가 나왔습니다.
      규칙을 익혔는지 보는 게 아니라 더 어려운 걸 시키는 것이 됩니다.
      그러면 별을 잃는 것이 벌처럼 느껴지고, 두 번째 걸음이 상이 아니라 함정이 됩니다.
    */
    expect(rejectTwin('책을 읽었어요.', '포도', [])).toBe('length-gap');
    // 비슷한 길이의 낱말은 괜찮습니다.
    expect(rejectTwin('사과', '포도', [])).toBeNull();
    expect(rejectTwin('바나나', '포도', [])).toBeNull();
  });

  it('짧은 문장의 짝으로 낱말 하나만 내지도 않는다', () => {
    // 너무 쉬워지면 규칙을 익혔는지 확인이 안 됩니다.
    expect(rejectTwin('산', '닭이 울어요', [])).toBe('length-gap');
  });

  it('비슷한 길이는 통과한다', () => {
    expect(lengthOk(8, 9)).toBe(true);
    expect(lengthOk(12, 9)).toBe(true);
    expect(lengthOk(5, 9)).toBe(true);
  });

  it('길이 검사가 15칸 검사보다 먼저 막지 않는다', () => {
    // 15칸을 넘는 것은 그 이유로 떨어져야 무엇이 문제인지 로그에 바르게 남습니다.
    const 긴것 = '아주 기다랗고 길어서 한 줄에 들어가지 않는 문장이에요';
    expect(rejectTwin(긴것, '닭이 울어요', [])).toBe('too-long');
  });
});

describe('겨눈 자리를 비껴가지 않는다 — 실제로 나온 짝에서 배운 것', () => {
  it('겹받침을 틀렸으면 짝에도 겹받침이 있어야 한다', () => {
    /*
      「닭」을 「닥」으로 쓴 아이는 받침 일반이 아니라 겹받침 ㄺ 을 놓친 것입니다.
      「밥을 먹어요」는 받침이 있지만 겨눈 자리를 비껴갑니다 —
      아이는 쉽게 맞히고 졸업하지만 다음에 「흙」이 나오면 또 틀립니다.
      실제로 이 짝이 나왔습니다.
    */
    expect(rejectTwin('밥을 먹어요', '닭이 울어요', ['batchim'])).toBe('missing-error-type');
    expect(rejectTwin('흙을 만졌어요', '닭이 울어요', ['batchim'])).toBeNull();
    expect(rejectTwin('값이 비싸요', '닭이 울어요', ['batchim'])).toBeNull();
  });

  it('원본에 겹받침이 없으면 홑받침 짝도 괜찮다', () => {
    // 「밥」을 틀린 아이에게 겹받침까지 요구하면 더 어려운 것을 시키는 셈입니다.
    expect(rejectTwin('산에 올라요', '밥을 먹어요', ['batchim'])).toBeNull();
  });

  it('띄어쓰기는 어절 둘이면 된다 — 원본보다 엄격하면 안 된다', () => {
    /*
      처음에는 셋을 요구했는데 「학교에 갑니다」(어절 둘)를 틀린 아이에게
      낼 짝이 하나도 안 남았습니다. 후보 셋이 전부 이 조건에 걸려 떨어졌습니다.
    */
    expect(rejectTwin('집에 갑니다', '학교에 갑니다', ['spacing'])).toBeNull();
    expect(exercises('집에 갑니다', 'spacing')).toBe(true);
    // 어절이 하나면 띄어쓸 자리가 없습니다.
    expect(exercises('학교', 'spacing')).toBe(false);
  });
});

describe('안 겨눈 자리는 묻지 않는다', () => {
  it('원본에 마침표가 없으면 짝에서도 뗀다', () => {
    /*
      「포도」의 짝으로 「복숭아.」가 나왔습니다. 아이는 마침표까지 써야 맞는데
      그건 원본에서 안 물었던 것입니다 — 같은 규칙을 익혔는지 보는 일에 군더더기가 붙습니다.
    */
    expect(matchPunctuation('복숭아.', '포도')).toBe('복숭아');
    expect(chooseTwin(['복숭아.'], '포도', []).sentence).toBe('복숭아');
  });

  it('원본에 마침표가 있으면 그대로 둔다', () => {
    expect(matchPunctuation('밥을 먹어요.', '닭이 울어요.')).toBe('밥을 먹어요.');
  });

  it('문장부호를 틀린 아이에게는 그대로 둔다', () => {
    // 그게 겨눈 자리입니다.
    const { sentence } = chooseTwin(['어디 가니?'], '뭐 하니?', ['punct']);
    expect(sentence).toBe('어디 가니?');
  });
});
