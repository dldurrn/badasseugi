import { SPELLING_BANK, type SpellingQuestion } from '@/data/spelling-bank';
import type { ErrorType } from './grading';
import { decompose } from './hangul';
import { toCells, WONGOJI_COLS } from './wongoji';

/**
 * 짝 문제 — 오답노트의 **두 번째 걸음**.
 *
 * 지금까지는 틀린 문제를 **같은 것으로 두 번** 풀렸습니다.
 * 그런데 두 번째쯤이면 아이가 규칙을 익힌 게 아니라 **그 문장을 외운** 것일 수 있습니다.
 * 절대 원칙 5가 두 번을 요구하는 이유는 「찍어서 맞힌 것을 거르기 위해서」인데,
 * 같은 문장을 두 번 내면 **찍기는 걸러도 암기는 못 거릅니다.**
 *
 * 그래서 두 번째를 **같은 규칙, 다른 문제**로 바꿉니다.
 * 별 두 개도, 연속도, 하나라도 틀리면 0으로 돌아가는 것도 그대로입니다.
 * 바뀌는 것은 두 번째 문제의 출처뿐이라, 원칙을 깨는 게 아니라
 * 원칙이 적어 둔 목적에 더 가까워집니다.
 *
 * **이 파일에는 AI 도 네트워크도 없습니다.**
 *  - 맞춤법 짝은 문제은행에서 고릅니다. 원가 0원, 즉시, 사람이 쓴 문항.
 *  - 받아쓰기 짝은 AI 가 만들지만, **만든 것을 거르는 일은 여기서** 합니다.
 *
 * 이 층을 그대로 두고 AI 층(`/api/twin`)만 들어내도 맞춤법 짝은 그대로 돕니다.
 * 그게 분리가 제대로 됐다는 증거입니다.
 */

/* ------------------------------------------------------------------ */
/* 맞춤법 — 문제은행에서 고르기                                          */
/* ------------------------------------------------------------------ */

/**
 * 같은 태그의 다른 문항.
 *
 * 맞춤법 오답을 저장할 때 `errorTypes` 에 문항의 `tag` 를 그대로 넣어 둡니다
 * (`SpellingRunner`). 그래서 새로 저장할 것 없이 태그만 보면 됩니다.
 *
 * **이미 낸 것과 이미 틀린 것은 뺍니다.** 짝으로 냈던 문제를 또 내면
 * 결국 같은 것을 두 번 푸는 셈이 되어 애초에 고치려던 문제로 돌아갑니다.
 *
 * @param exclude 원본 문항 id, 이미 짝으로 냈던 id, 다른 오답노트에 있는 id
 * @param pick    무작위 자리를 고르는 함수. 테스트에서 고정할 수 있게 받습니다.
 */
export function pickSpellingTwin(
  tags: string[],
  exclude: string[],
  pick: (n: number) => number = (n) => Math.floor(Math.random() * n),
): SpellingQuestion | null {
  const 뺄것 = new Set(exclude);
  const 후보 = SPELLING_BANK.filter((q) => tags.includes(q.tag) && !뺄것.has(q.id));
  if (후보.length === 0) return null;
  return 후보[Math.min(후보.length - 1, Math.max(0, pick(후보.length)))] ?? null;
}

/* ------------------------------------------------------------------ */
/* 받아쓰기 — AI 가 만든 후보 거르기                                     */
/*                                                                     */
/* **AI 말을 믿지 않습니다.** 여기 들어온 문장이 아이의 별을 가르므로,   */
/* 내장 문제은행에 걸어 둔 것과 같은 기준을 그대로 통과해야 합니다.       */
/* ------------------------------------------------------------------ */

/** 왜 떨어졌는지. 로그로 남겨야 프롬프트를 고칠 단서가 생깁니다. */
export type TwinReject =
  | 'empty'
  | 'too-long'
  | 'same-as-origin'
  | 'ambiguous-sound'
  | 'missing-error-type'
  | 'length-gap'
  | 'not-hangul';

/**
 * 소리만으로는 표기를 정할 수 없는 낱말들.
 *
 * ㅐ와 ㅔ는 발음이 합쳐져 **어떤 목소리로 읽어도 귀로 구분할 수 없습니다.**
 * 낱말 하나가 문항 전체이고 두 표기가 모두 실제 낱말이면
 * 아이가 무엇을 써도 정답이라 할 수 없습니다 — 그런 문항은 받아쓰기에 두면 안 됩니다.
 * (그래서 이런 낱말은 문맥이 있는 **맞춤법** 쪽에서 다룹니다.)
 *
 * 내장 문제은행에 걸려 있는 기준과 같은 목록입니다.
 */
const AMBIGUOUS = ['개', '게', '새', '세', '배', '베', '매', '메'];

/** 겹받침 — 「닭」의 ㄺ 처럼 소리와 표기가 어긋나 아이가 가장 많이 틀리는 자리 */
const 겹받침 = ['ㄳ', 'ㄵ', 'ㄶ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅄ'];

/** 헷갈리는 중성 — 「의사」를 「이사」로 쓰는 자리 */
const 어려운모음 = ['ㅢ', 'ㅚ', 'ㅟ', 'ㅙ', 'ㅞ', 'ㅐ', 'ㅔ'];

/** 된소리·거센소리 초성 — 「깎다」를 「깍다」로 쓰는 자리 */
const 어려운자음 = ['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅊ'];

/**
 * 이 문장이 정말 그 오류 유형을 연습시키는가.
 *
 * **채점 엔진이 「이건 받침 오류다」를 판정할 때 쓰는 바로 그 분해기**로
 * 「이 문장에 받침이 들어 있나」를 확인합니다. 같은 자를 쓰니 어긋날 수가 없습니다.
 *
 * 여섯 유형 중 넷은 기계가 확실히 봅니다. `spacing` 은 어절 수까지,
 * `letter` 는 볼 수 있는 것이 없어 통과시킵니다 —
 * 다만 잘못 뚫려도 **잃는 것은 별 하나**입니다(오답노트 풀이는 점수에 안 들어갑니다).
 */
export function exercises(sentence: string, type: ErrorType): boolean {
  const 글자 = [...sentence];

  switch (type) {
    case 'batchim': {
      // 받침이 있어야 하고, 겹받침이 하나라도 있으면 더 좋습니다.
      const 받침들 = 글자.map((c) => decompose(c)?.jong ?? '').filter(Boolean);
      if (받침들.length === 0) return false;
      return true;
    }
    case 'vowel':
      return 글자.some((c) => 어려운모음.includes(decompose(c)?.jung ?? ''));
    case 'consonant':
      return 글자.some((c) => 어려운자음.includes(decompose(c)?.cho ?? ''));
    case 'punct':
      return /[.,!?…]/.test(sentence);
    case 'spacing':
      /*
        띄어쓸 자리가 하나라도 있으면 됩니다.

        처음에는 어절 셋을 요구했는데, 그러면 **원본보다 엄격해집니다** —
        「학교에 갑니다」(어절 둘)를 틀린 아이에게 낼 짝이 하나도 안 남았습니다.
        실제로 후보 셋이 전부 이 조건에 걸려 떨어졌습니다.
      */
      return sentence.trim().split(/\s+/).length >= 2;
    case 'letter':
      // 「통째로 다른 글자」는 겨눌 자리가 정해져 있지 않습니다. 볼 수 있는 것이 없습니다.
      return true;
  }
}

/**
 * 원본과 비슷한 길이인가.
 *
 * **짝은 원본과 같은 난이도여야 합니다.**
 * 「포도」(2칸)를 틀린 아이에게 「책을 읽었어요.」(8칸)를 내면,
 * 규칙을 익혔는지 보는 게 아니라 더 어려운 걸 시키는 것이 됩니다.
 * 그러면 별을 잃는 것이 벌처럼 느껴지고, 두 번째 걸음이 상이 아니라 함정이 됩니다.
 *
 * 실제로 처음 붙였을 때 이 일이 났습니다 — AI 는 「비슷한 규칙」은 지켰지만
 * 「비슷한 길이」는 아무도 시키지 않았으니 지킬 까닭이 없었습니다.
 */
export function lengthOk(candidateCells: number, originCells: number): boolean {
  const 아래 = Math.max(1, Math.floor(originCells * 0.6));
  const 위 = Math.ceil(originCells * 1.8) + 2;
  return candidateCells >= 아래 && candidateCells <= 위;
}

/** 겹받침이 든 문장인가. 같은 조건을 통과한 후보 중에서 고를 때 씁니다. */
export function has겹받침(sentence: string): boolean {
  return [...sentence].some((c) => 겹받침.includes(decompose(c)?.jong ?? ''));
}

/**
 * 후보 하나를 검사합니다. 통과하면 null, 떨어지면 이유.
 *
 * @param origin 원본 문장. 이것과 같거나 거의 같으면 짝이 아닙니다.
 */
export function rejectTwin(
  candidate: string,
  origin: string,
  types: ErrorType[],
): TwinReject | null {
  const s = candidate.trim();
  if (s.length === 0) return 'empty';

  // 한글이 아닌 것이 섞이면 받아쓰기가 되지 않습니다.
  if (!/[가-힣]/.test(s)) return 'not-hangul';
  if (/[a-zA-Z0-9]/.test(s)) return 'not-hangul';

  /*
    원고지 한 줄(15칸)에 들어가야 합니다.
    두 줄이 되면 아이 화면에서 확인 버튼이 아래로 밀리고,
    내장 문제은행도 20단계를 뺀 전부가 한 줄입니다.
  */
  const 칸 = toCells(s).length;
  if (칸 > WONGOJI_COLS) return 'too-long';

  // 원본과 난이도가 비슷해야 합니다. 낱말 하나를 틀린 아이에게 긴 문장을 내면 안 됩니다.
  if (!lengthOk(칸, toCells(origin).length)) return 'length-gap';

  // 원본과 같으면 「같은 문장 두 번」으로 되돌아갑니다. 애초에 고치려던 것입니다.
  if (normalizeForCompare(s) === normalizeForCompare(origin)) return 'same-as-origin';

  /*
    낱말 하나가 문항 전체이고 그 낱말이 두 표기 모두 실제 낱말이면,
    아이가 무엇을 써도 정답이라 할 수 없습니다.
    여러 어절이면 문맥이 있어 안전합니다.
  */
  if (!s.includes(' ') && AMBIGUOUS.includes(s.replace(/[.,!?…]/g, ''))) {
    return 'ambiguous-sound';
  }

  // 겨눈 오류를 하나라도 연습시켜야 합니다.
  if (types.length > 0 && !types.some((t) => exercises(s, t))) {
    return 'missing-error-type';
  }

  /*
    **원본이 겹받침이면 짝에도 겹받침이 있어야 합니다.**

    「닭」을 「닥」으로 쓴 아이는 받침 일반이 아니라 **겹받침 ㄺ** 을 놓친 것입니다.
    그런데 「밥을 먹어요」를 내면 받침은 있지만 겨눈 자리를 비껴갑니다 —
    아이는 쉽게 맞히고 졸업하지만, 다음에 「흙」이 나오면 또 틀립니다.
    실제로 이 짝이 나왔습니다.
  */
  if (types.includes('batchim') && has겹받침(origin) && !has겹받침(s)) {
    return 'missing-error-type';
  }

  return null;
}

/** 견줄 때만 쓰는 다듬기. 공백과 문장부호 차이로 「다른 문장」이 되면 안 됩니다. */
function normalizeForCompare(s: string): string {
  return s.replace(/[\s.,!?…]/g, '');
}

/**
 * 후보 여럿 중 **통과한 첫 번째**를 고릅니다.
 *
 * 후보를 셋씩 받는 이유가 이것입니다 — 하나만 받으면 떨어질 때마다 다시 불러야 하는데,
 * 그 사이 아이가 기다립니다. 한 번에 셋을 받아 거르는 편이 싸고 빠릅니다.
 *
 * 하나도 통과 못 하면 null 입니다. 그때는 **지금 동작(같은 문장 두 번)으로 조용히 내려갑니다.**
 * 아이 화면에는 아무 일도 일어나지 않습니다.
 */
export function chooseTwin(
  candidates: string[],
  origin: string,
  types: ErrorType[],
): { sentence: string | null; rejects: Array<{ sentence: string; why: TwinReject }> } {
  const rejects: Array<{ sentence: string; why: TwinReject }> = [];
  for (const c of candidates) {
    const 다듬은것 = matchPunctuation(c.trim(), origin);
    const why = rejectTwin(다듬은것, origin, types);
    if (!why) return { sentence: 다듬은것, rejects };
    rejects.push({ sentence: c, why });
  }
  return { sentence: null, rejects };
}

/**
 * 원본에 마침표가 없으면 짝에서도 뗍니다.
 *
 * 「포도」의 짝으로 「복숭아.」가 나왔습니다. 아이는 마침표까지 써야 맞는데,
 * 그건 **겨눈 자리가 아닙니다** — 원본에서는 안 물었던 것을 짝에서 묻는 셈이라
 * 같은 규칙을 익혔는지 보는 일에 군더더기가 붙습니다.
 *
 * 반대로 원본에 마침표가 있으면 그대로 둡니다. 그때는 물어야 할 것이 맞습니다.
 * 문장부호 자체를 틀린 아이(punct)에게도 그대로 둡니다 — 그게 겨눈 자리니까요.
 */
export function matchPunctuation(candidate: string, origin: string): string {
  if (/[.!?…]$/.test(origin.trim())) return candidate;
  return candidate.replace(/[.!?…]+$/, '').trim();
}

/* ------------------------------------------------------------------ */
/* 걸음 — 지금 원본을 푸나 짝을 푸나                                     */
/* ------------------------------------------------------------------ */

export type TwinStep = 'origin' | 'twin';

/**
 * 지금 몇 번째 걸음인가.
 *
 * **칸을 따로 두지 않습니다.** `streak` 이 이미 답을 갖고 있습니다 —
 * 0이면 아직 원본도 못 맞혔고, 1이면 원본을 맞혀 짝을 풀 차례입니다.
 * 상태를 두 군데 두면 언젠가 어긋나고, 어긋나면 아이가 같은 문제를 두 번 풀거나
 * 원본을 건너뛰게 됩니다.
 *
 * 짝이 없으면(아직 못 만들었거나 만들다 실패했으면) 언제나 원본입니다 —
 * 그게 지금까지의 동작이고, 그대로 굴러갑니다.
 */
export function stepOf(note: { streak: number; twinRef: string | null }): TwinStep {
  if (!note.twinRef) return 'origin';
  return note.streak >= 1 ? 'twin' : 'origin';
}

/** 짝을 만들어 볼 만한가. 실패한 것을 무한히 다시 만들지 않기 위해 횟수를 봅니다. */
export const MAX_TWIN_TRIES = 2;

export function needsTwin(note: {
  twinRef: string | null;
  twinTries: number;
  streak: number;
}): boolean {
  if (note.twinRef) return false;
  if (note.twinTries >= MAX_TWIN_TRIES) return false;
  // 이미 졸업했으면 만들 까닭이 없습니다.
  return note.streak < 2;
}
