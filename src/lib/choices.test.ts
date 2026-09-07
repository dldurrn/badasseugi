import { describe, expect, it } from 'vitest';
import { DICTATION_BANK } from '@/data/dictation-bank';
import {
  END_OPTIONS,
  JOIN_COMMA,
  JOIN_NONE,
  JOIN_OPTIONS,
  JOIN_SPACE,
  buildSegments,
  confusable,
  hasChoices,
  joinLabel,
  nextAsk,
  prefixCells,
  splitWord,
  wordOptions,
} from './choices';
import { isSyllable, normalize } from './hangul';
import { toCells } from './wongoji';

/**
 * 여기서 지킬 것 —
 *
 * 1. **귀로 가려지는 것을 고르게 하면 안 됩니다.** 소리를 듣고 알 수 있는 것을 물으면
 *    듣기 연습이 아니라 눈치 게임이 됩니다. 반대로 아무도 안 고를 글자를 내놓으면
 *    문제가 공짜가 됩니다.
 * 2. **이어 붙이면 원래 문장이 되어야 합니다.** 이 왕복이 깨지면 아이가 다 골랐는데도
 *    화면의 문장이 원래 문장과 달라집니다.
 * 3. **조각이 낱말처럼 읽혀야 합니다.** 「목걸 | 이」로 잘리면 아이는 「목걸」이 무엇인지 모릅니다.
 */

/* ------------------------------------------------------------------ */

describe('후보 만들기 — 귀로 못 가리는 것만', () => {
  it('받침을 대표음이 같은 것으로 바꾼다', () => {
    // 「갔/갓」은 어떤 목소리로 읽어도 같은 소리입니다.
    expect(confusable('갔')?.char).toBe('갓');
    expect(confusable('꽃')?.char).toBe('꼿');
    expect(confusable('밭')?.char).toBe('밧');
    expect(confusable('앞')?.char).toBe('압');
    expect(confusable('밖')?.char).toBe('박');
  });

  it('아이가 실제로 쓰는 쪽으로만 바꾼다', () => {
    /*
      미리보기에서 바로 드러난 것입니다 — 「학교」의 후보로 「핚교」가 나왔습니다.
      소리는 같지만 **그렇게 쓰는 아이는 없어서** 2지선다가 1지선다가 됩니다.
      쉬운 표기(ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅇ ㅅ)에서 어려운 표기로 가는 길은 막아 둡니다.
    */
    for (const ch of ['학', '갓', '밥', '곧']) {
      expect(confusable(ch), `${ch} 을 더 어렵게 쓰는 아이는 없습니다`).toBeNull();
    }
  });

  it('겹받침은 대표음 홑받침으로 보내고, 가장 먼저 겨눈다', () => {
    // 「닭」을 「닥」으로 쓰는 자리가 저학년이 가장 많이 틀리는 곳입니다.
    expect(confusable('닭')?.char).toBe('닥');
    expect(confusable('닭')?.rank).toBe(0);
    expect(confusable('넓')?.char).toBe('널');
    expect(confusable('앉')?.char).toBe('안');
    expect(confusable('삶')?.char).toBe('삼');
    expect(confusable('많')?.char).toBe('만');
    expect(confusable('값')?.char).toBe('갑');

    // 홑받침·모음보다 앞섭니다.
    expect(confusable('갔')?.rank).toBe(1);
    expect(confusable('개')?.rank).toBe(2);
  });

  it('소리가 저마다 다른 받침은 후보를 안 만든다', () => {
    // ㄴ·ㄹ·ㅁ·ㅇ 은 귀로 가려집니다. 여기를 물으면 듣기 연습이 아닙니다.
    for (const ch of ['눈', '물', '봄', '강']) {
      expect(confusable(ch), `${ch} 은 소리로 가려집니다`).toBeNull();
    }
    // ㅎ 받침은 짝이 될 만한 실제 낱말이 거의 없어 뺐습니다.
    expect(confusable('좋')).toBeNull();
  });

  it('ㅐㅔ · ㅒㅖ · ㅚㅙㅞ 만 바꾼다', () => {
    expect(confusable('개')?.char).toBe('게');
    expect(confusable('게')?.char).toBe('개');
    expect(confusable('얘')?.char).toBe('예');
    expect(confusable('돼')?.char).toBe('되');
    expect(confusable('되')?.char).toBe('돼');
  });

  it('초성은 바꾸지 않는다 — 된소리는 귀로 가려진다', () => {
    // 「가」와 「까」는 다르게 들립니다. 들어서 알 수 있는 것은 문제가 아닙니다.
    expect(confusable('가')).toBeNull();
    expect(confusable('다')).toBeNull();
    expect(confusable('바')).toBeNull();
  });

  it('한글이 아니면 후보가 없다', () => {
    for (const ch of ['.', ',', '"', 'a', '1', ' ']) {
      expect(confusable(ch)).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ */

describe('낱말 후보', () => {
  it('정답이 반드시 들어 있다', () => {
    for (const word of ['학교에', '갔습니다', '닭', '됐어']) {
      expect(wordOptions(word, () => 0)).toContain(word);
    }
  });

  it('후보는 둘 — 억지로 셋을 채우지 않는다', () => {
    const options = wordOptions('갔습니다', () => 0);
    expect(options).toHaveLength(2);
    expect(new Set(options).size).toBe(2);
  });

  it('오답은 한 자리만 다르다', () => {
    // 두 군데를 바꾸면 소리를 안 듣고도 「더 틀려 보이는 쪽」으로 걸러집니다.
    const [a, b] = wordOptions('갔습니다', () => 0);
    const 다른자리 = [...a].filter((ch, i) => ch !== [...b][i]);
    expect(다른자리).toHaveLength(1);
  });

  it('바꿀 자리가 없으면 정답 하나뿐이다', () => {
    // 「나비」에는 귀로 못 가릴 자리가 없습니다. 억지 문제를 만들지 않습니다.
    for (const word of ['나비', '포도', '를', '우리']) {
      expect(wordOptions(word, () => 0)).toEqual([word]);
    }
  });

  it('겹받침이 있으면 거기를 겨눈다', () => {
    // 「닭에」에는 겹받침(ㄺ)과 모음(ㅔ)이 함께 있지만 겹받침이 값집니다.
    expect(wordOptions('닭에', () => 0)).toContain('닥에');
  });

  it('정답이 늘 앞에 오지는 않는다', () => {
    // 자리가 고정이면 아이가 소리를 안 듣고 첫째 것만 누릅니다.
    const 앞 = wordOptions('갔어', () => 0);
    const 뒤 = wordOptions('갔어', () => 1);
    expect(앞[0]).not.toBe(뒤[0]);
  });

  it('같은 pick 이면 언제나 같은 결과다', () => {
    const a = wordOptions('학교에', () => 0);
    const b = wordOptions('학교에', () => 0);
    expect(a).toEqual(b);
  });
});

/* ------------------------------------------------------------------ */

describe('어절 자르기 — 「붙여요」가 정답인 자리를 만든다', () => {
  it('체언과 조사를 가른다', () => {
    expect(splitWord('학교에')).toEqual(['학교', '에']);
    expect(splitWord('우유를')).toEqual(['우유', '를']);
    expect(splitWord('도서관에서')).toEqual(['도서관', '에서']);
    expect(splitWord('밤하늘의')).toEqual(['밤하늘', '의']);
  });

  it('용언과 어미를 가른다', () => {
    expect(splitWord('감사합니다')).toEqual(['감사', '합니다']);
    expect(splitWord('인사했어요')).toEqual(['인사', '했어요']);
    expect(splitWord('청소해요')).toEqual(['청소', '해요']);
  });

  it('낱말을 쪼개지 않는다', () => {
    /*
      여기가 이 함수에서 제일 위험한 곳입니다.
      「목걸이」가 「목걸 | 이」가 되면 아이는 「목걸」이라는 조각을 보게 됩니다.
      그래서 한 글자짜리 꼬리 중 이·도·고·만·지는 아예 목록에서 뺐습니다.
    */
    for (const word of ['목걸이', '색종이', '나들이', '냉장고', '포도', '파도', '딱지', '봉지']) {
      expect(splitWord(word), `${word} 는 한 낱말입니다`).toEqual([word]);
    }
  });

  it('줄기가 한 글자면 자르지 않는다', () => {
    // 「밥 | 을」은 맞는 분석이지만, 같은 규칙이 「포 | 도」를 만듭니다.
    expect(splitWord('밥을')).toEqual(['밥을']);
    expect(splitWord('나는')).toEqual(['나는']);
    expect(splitWord('형은')).toEqual(['형은']);
  });

  it('한 번만 자른다', () => {
    // 잘게 쪼갤수록 조각이 낱말처럼 안 읽힙니다.
    expect(splitWord('학교에서는')).toHaveLength(2);
  });

  it('부호가 붙은 조각은 건드리지 않는다', () => {
    expect(splitWord('"안녕!"')).toEqual(['"안녕!"']);
    expect(splitWord('갔어요.')).toEqual(['갔어요.']);
  });

  it('긴 꼬리를 먼저 본다', () => {
    // 「에서」를 두고 「서」만 떼면 「도서관에 | 서」가 됩니다.
    expect(splitWord('운동장에서')).toEqual(['운동장', '에서']);
    expect(splitWord('반대말이에요')).toEqual(['반대말', '이에요']);
  });
});

/* ------------------------------------------------------------------ */

describe('걸음으로 펴기', () => {
  const 고정 = () => 0;

  it('이어 붙이면 원래 문장이 된다', () => {
    // 이 왕복이 깨지면 아이가 다 골랐는데 화면의 문장이 원래와 달라집니다.
    for (const s of ['우유를 마시고, 빵도 먹어요.', '"안녕!" 하고 인사했어요.', '포도']) {
      expect(buildSegments(s, 고정).map((x) => x.text).join('')).toBe(normalize(s));
    }
  });

  it('낱말 사이마다 이음을 묻는다', () => {
    /*
      **매번 묻습니다.** 헷갈리는 자리에서만 물으면 물음이 뜬다는 것 자체가 답을 흘립니다
      — 아이는 「물어보네? 어려운 데구나」로 읽습니다.
    */
    const segs = buildSegments('학교에 갔어요.', 고정);
    const joins = segs.filter((s) => s.ask?.kind === 'join');
    // 학교|에, 에␣갔어요 — 조사를 가른 자리까지 둘입니다.
    expect(joins).toHaveLength(2);
    for (const j of joins) expect(j.ask!.options).toEqual(JOIN_OPTIONS);
  });

  it('조사를 가른 자리의 정답은 「붙여요」다', () => {
    // 저학년이 가장 많이 틀리는 자리입니다 — 「학교 에 갔어요」.
    const segs = buildSegments('학교에 갔어요.', 고정);
    const 첫이음 = segs.find((s) => s.ask?.kind === 'join');
    expect(첫이음!.text).toBe(JOIN_NONE);
  });

  it('쉼표는 낱말이 아니라 이음으로 간다', () => {
    const segs = buildSegments('우유를 마시고, 빵도 먹어요.', 고정);
    expect(segs.some((s) => s.text === JOIN_COMMA && s.ask?.kind === 'join')).toBe(true);
    // 낱말 조각에는 쉼표가 남지 않습니다.
    expect(segs.some((s) => s.ask?.kind === 'word' && s.text.includes(','))).toBe(false);
  });

  it('끝 문장부호를 따로 묻는다', () => {
    const segs = buildSegments('같이 놀자!', 고정);
    const 끝 = segs[segs.length - 1];
    expect(끝.text).toBe('!');
    expect(끝.ask).toEqual({ kind: 'end', options: END_OPTIONS });
  });

  it('문장부호가 없으면 끝 걸음도 없다', () => {
    const segs = buildSegments('파란 하늘', 고정);
    expect(segs.some((s) => s.ask?.kind === 'end')).toBe(false);
  });

  it('문장 가운데 마침표는 조각에 붙여 둔다', () => {
    // 20단계는 두 문장을 잇는 것이 목적이라, 가운데 「.」을 따로 물어도 배움에 보태는 게 없습니다.
    const segs = buildSegments('오늘은 소풍을 갔어요. 정말 즐거웠어요.', 고정);
    expect(segs.some((s) => s.text === '갔어요.')).toBe(true);
    expect(segs.filter((s) => s.ask?.kind === 'end')).toHaveLength(1);
  });

  it('이음 라벨은 아이가 읽을 수 있는 말이다', () => {
    expect(joinLabel(JOIN_SPACE)).toBe('띄어요');
    expect(joinLabel(JOIN_NONE)).toBe('붙여요');
    expect(joinLabel(JOIN_COMMA)).toBe(',');
  });
});

/* ------------------------------------------------------------------ */

describe('물을 것이 없는 문장', () => {
  it('받침이 ㄴ·ㅇ뿐인 외마디는 건너뛴다', () => {
    // 1·2단계가 그렇습니다. 버그가 아니라 그 문장이 쉽다는 뜻입니다.
    expect(hasChoices('포도')).toBe(false);
    expect(hasChoices('안경')).toBe(false);
    expect(hasChoices('창문')).toBe(false);
  });

  it('겹받침·받침·모음이 있거나 낱말이 둘이면 묻는다', () => {
    expect(hasChoices('닭')).toBe(true);
    expect(hasChoices('갔어요')).toBe(true);
    // 낱말이 둘이면 이음만으로도 물을 거리가 됩니다.
    expect(hasChoices('파란 하늘')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe('칸 세기 — 쓰는 화면과 같아야 한다', () => {
  it('끝의 「띄어요」가 칸을 차지한다', () => {
    // toCells 는 채점을 위해 끝 공백을 자릅니다. 여기서 그러면 커서가 제자리에 멈춥니다.
    expect(prefixCells('학교에 ')).toHaveLength(4);
    expect(toCells('학교에 ')).toHaveLength(3);
  });

  it('쉼표 뒤는 칸을 차지하지 않는다 — 원고지 규칙', () => {
    expect(prefixCells('마시고, ')).toHaveLength(4);
  });

  it('다 고른 문장의 칸 수가 정답의 칸 수와 같다', () => {
    for (const s of ['우유를 마시고, 빵도 먹어요.', '학교에 갔어요.', '파란 하늘']) {
      expect(prefixCells(normalize(s))).toEqual(toCells(s));
    }
  });
});

describe('다음 걸음 찾기', () => {
  it('물을 것이 없는 조각은 지나친다', () => {
    const segs = buildSegments('파란 하늘', () => 0);
    // 「파란」에는 물을 것이 없으므로 첫 물음은 이음입니다.
    expect(segs[nextAsk(segs, 0)].ask?.kind).toBe('join');
  });

  it('더 물을 것이 없으면 끝 자리를 돌려준다', () => {
    const segs = buildSegments('포도', () => 0);
    expect(nextAsk(segs, 0)).toBe(segs.length);
  });
});

/* ------------------------------------------------------------------ */

describe('내장 문제은행 전 문장', () => {
  const 전부 = DICTATION_BANK.flatMap((set) => set.sentences);

  it('이어 붙이면 원래 문장으로 돌아온다', () => {
    for (const s of 전부) {
      expect(buildSegments(s, () => 0).map((x) => x.text).join(''), s).toBe(normalize(s));
    }
  });

  it('후보가 모두 온전한 글자다', () => {
    for (const s of 전부) {
      for (const seg of buildSegments(s, () => 0)) {
        if (seg.ask?.kind !== 'word') continue;
        expect(seg.ask.options, s).toContain(seg.text);
        for (const opt of seg.ask.options) {
          // 한글이 아닌 부분(따옴표·마침표)은 그대로 두고, 한글 자리는 온전해야 합니다.
          const 한글 = [...opt].filter((ch) => /[가-힣]/.test(ch));
          for (const ch of 한글) expect(isSyllable(ch), `${s} → ${opt}`).toBe(true);
        }
      }
    }
  });

  it('빈 조각이 생기지 않는다', () => {
    for (const s of 전부) {
      for (const seg of buildSegments(s, () => 0)) {
        if (seg.ask?.kind === 'word' || seg.ask === null) {
          if (seg.text === '') continue; // 「붙여요」로 놓인 이음
          expect(seg.text.trim().length, s).toBeGreaterThan(0);
        }
      }
    }
  });

  it('3단계부터는 모든 단계에 고를 것이 있다', () => {
    // 한 문장도 없으면 그 단계가 이 모드에서 통째로 사라집니다.
    for (const set of DICTATION_BANK) {
      if (set.id === 'lv1' || set.id === 'lv2') continue;
      const 있는것 = set.sentences.filter(hasChoices);
      expect(있는것.length, `${set.name} 에 고를 것이 없습니다`).toBeGreaterThan(0);
    }
  });

  it('쉬운 단계는 거의 다 건너뛴다', () => {
    /*
      1·2단계는 받침 없는 낱말과 ㄴ·ㅇ·ㄹ·ㅁ·ㄱ 받침 낱말이라
      귀로 못 가릴 자리가 거의 없습니다. 「그네/그내」(ㅔ) 하나쯤 남습니다.
      이 단계가 통째로 남는다면 후보 규칙이 **소리로 가려지는 것까지** 물고 있다는 뜻입니다.
    */
    const 쉬운단계 = DICTATION_BANK.filter((s) => s.id === 'lv1' || s.id === 'lv2');
    for (const set of 쉬운단계) {
      const 남는것 = set.sentences.filter(hasChoices);
      expect(남는것.length, set.name).toBeLessThanOrEqual(1);
      // 남는 것은 전부 「귀로 못 가리는 자리」가 실제로 있어야 합니다.
      for (const s of 남는것) {
        expect([...s].some((ch) => confusable(ch) !== null), s).toBe(true);
      }
    }
  });
});
