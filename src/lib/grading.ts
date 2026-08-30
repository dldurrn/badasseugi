/**
 * 받아쓰기 채점 엔진
 *
 * 설계 원칙
 * 1. 단순 O/X가 아니라 "무엇이 어떻게 틀렸는지"를 글자 단위로 짚어야 한다.
 * 2. 정답과 입력을 편집거리(Levenshtein) 기반으로 정렬해서,
 *    화면에서 위/아래로 나란히 비교할 수 있는 열(column) 구조를 만든다.
 * 3. 오류는 한국어 받아쓰기에서 실제로 의미 있는 축으로 분류한다.
 *    (받침 / 모음 / 자음 / 띄어쓰기 / 문장부호 / 그 외)
 *
 * 이 모듈은 순수 함수만 포함하며 DOM·React에 의존하지 않습니다.
 * 반드시 grading.test.ts 를 함께 유지하세요.
 */

import { decompose, isPunctuation, normalize } from './hangul';

/** 오류 유형. 오답노트 태그와 리포트 약점 분석에 그대로 쓰입니다. */
export type ErrorType =
  | 'spacing' // 띄어쓰기
  | 'punct' // 문장부호
  | 'batchim' // 받침 (초성·중성 동일, 종성만 다름)
  | 'vowel' // 모음 (초성·종성 동일, 중성만 다름) — 애/에, 왜/외 혼동
  | 'consonant' // 자음 (중성·종성 동일, 초성만 다름) — 가/까, 다/타 혼동
  | 'letter'; // 그 외 글자 오류, 누락, 추가

export const ERROR_LABEL: Record<ErrorType, string> = {
  spacing: '띄어쓰기',
  punct: '문장부호',
  batchim: '받침',
  vowel: '모음',
  consonant: '자음',
  letter: '글자',
};

/** 아이에게 보여줄 한 줄 설명. 지시가 아니라 다음에 뭘 볼지 알려주는 문장. */
export const ERROR_HINT: Record<ErrorType, string> = {
  spacing: '∨ 표시가 있는 곳에서 한 칸 띄어 써요.',
  punct: '마침표와 물음표까지 꼭 함께 써요.',
  batchim: '받침을 한 번 더 듣고 살펴봐요.',
  vowel: '모음이 달라요. ㅐ와 ㅔ처럼 비슷한 소리를 구분해 봐요.',
  consonant: '첫소리가 달라요. 세게 나는 소리인지 들어 봐요.',
  letter: '정답과 나란히 놓고 어떤 글자가 다른지 봐요.',
};

/** 정렬 연산 한 단위. */
export type AlignOp =
  | { type: 'eq'; answer: string; input: string }
  | { type: 'sub'; answer: string; input: string }
  | { type: 'del'; answer: string } // 정답에 있는데 입력에 없음
  | { type: 'ins'; input: string }; // 입력에만 있음

/** 화면 표시용 열(column). 위=내가 쓴 것, 아래=정답. */
export type Column =
  | { kind: 'same'; input: string; answer: string }
  | { kind: 'diff'; input: string; answer: string; error: ErrorType }
  | { kind: 'missing'; answer: string } // 빠뜨린 글자
  | { kind: 'extra'; input: string } // 더 쓴 글자
  | { kind: 'needSpace' } // 여기서 띄었어야 함 (∨)
  | { kind: 'extraSpace' }; // 여기는 붙였어야 함 (✕)

export interface GradeResult {
  correct: boolean;
  /** 정규화된 정답 */
  answer: string;
  /** 정규화된 입력 */
  input: string;
  /** 발견된 오류 유형 (중복 없음, 표시 우선순위 순으로 정렬됨) */
  errorTypes: ErrorType[];
  /** 화면 렌더링용 열 배열 */
  columns: Column[];
  /** 받침 오류 상세 — 자모 대조 표시에 사용 */
  batchimDetails: Array<{ answer: string; input: string }>;
}

/**
 * 공백을 진짜 글자와 맞바꾸는 값.
 *
 * **공백은 글자와 맞바꿀 수 있는 것이 아닙니다.** 띄어쓰기를 틀린 것과
 * 글자를 틀린 것은 아이에게 완전히 다른 이야기라, 한 자리에서 뭉뜽그리면 안 됩니다.
 *
 * 3인 것에는 까닭이 있습니다. 지움+넣음으로 돌아가는 값은 **언제나 2 이하**입니다 —
 * `dp[i-1][j] ≤ dp[i-1][j-1] + 1` 이 늘 성립하므로(한 글자 넣으면 닿는 자리니까)
 * `dp[i-1][j] + 1 ≤ dp[i-1][j-1] + 2` 입니다.
 * 그래서 3을 매기면 이 맞바꿈은 **뽑힐 수가 없습니다.** 금지한 것과 같습니다.
 * (2로 두면 지움+넣음과 동점이 되는데, 역추적이 맞바꿈을 먼저 보므로 그게 뽑힙니다.)
 */
const SPACE_SWAP_COST = 3;

/**
 * 두 글자를 맞바꾸는 값. **DP를 채울 때와 역추적할 때 같은 자를 써야 합니다.**
 * 둘이 어긋나면 계산한 길과 되짚는 길이 달라져 엉뚱한 정렬이 나옵니다.
 */
function subCost(answerCh: string, inputCh: string): number {
  if (answerCh === inputCh) return 0;
  // 한쪽만 공백이면 맞바꿈이 아니라 「띄어쓰기를 빠뜨렸다/더 넣었다」입니다.
  if ((answerCh === ' ') !== (inputCh === ' ')) return SPACE_SWAP_COST;
  return 1;
}

/**
 * 두 문자열을 글자 단위로 정렬합니다.
 *
 * 표준 Levenshtein DP를 계산한 뒤 역추적합니다.
 * 역추적 시 대체(sub)를 우선 고려해서, 같은 자리의 글자끼리 짝지어지도록 합니다.
 * (그래야 "받침만 다름"을 감지할 수 있습니다. del+ins로 쪼개지면 감지 불가.)
 *
 * **공백만은 예외입니다**(`subCost`). 공백을 글자와 맞바꿀 수 있게 두면
 * 값이 같은 길이 둘 생기고, 대체를 우선하는 역추적이 엉뚱한 쪽을 고릅니다.
 *
 *   정답 「작은 발자국」  입력 「자근발자국」
 *     맞는 길   작→자(1)  은→근(1)  공백 지움(1)      = 3
 *     엉뚱한 길 작 지움(1) 은→자(1)  공백→근 맞바꿈(1) = 3   ← 동점이라 이쪽이 뽑혔음
 *
 * 그러면 「자」가 「은」 밑에 놓여 위아래 견주기가 무너지고(절대 원칙 6),
 * ∨(띄어요) 표식이 사라져 **아이가 띄어쓰기를 틀렸다는 것조차 모릅니다.**
 * 게다가 오류 유형이 `letter`로 적혀 오답노트·리포트·짝 문제까지 잘못 겨눕니다.
 */
export function align(answer: string, input: string): AlignOp[] {
  const a = Array.from(answer);
  const b = Array.from(input);
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = subCost(a[i - 1], b[j - 1]);
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + cost,
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
      );
    }
  }

  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      // DP를 채울 때와 **같은 자**를 씁니다. 어긋나면 되짚는 길이 달라집니다.
      const cost = subCost(a[i - 1], b[j - 1]);
      if (dp[i][j] === dp[i - 1][j - 1] + cost) {
        ops.push(
          cost === 0
            ? { type: 'eq', answer: a[i - 1], input: b[j - 1] }
            : { type: 'sub', answer: a[i - 1], input: b[j - 1] },
        );
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: 'del', answer: a[i - 1] });
      i--;
      continue;
    }
    // 남은 경우는 삽입
    ops.push({ type: 'ins', input: b[j - 1] });
    j--;
  }

  return ops.reverse();
}

/**
 * 같은 글자가 이어질 때, 더 쓴 글자·빠뜨린 글자 표시를 뒤쪽으로 밉니다.
 *
 * 편집거리는 「종이를 접다..」에서 두 점 중 **어느 것**이 군더더기인지 가리지 않습니다.
 * 둘 다 값이 같아서, 역추적이 앞엣것을 골라 버립니다.
 * 그러면 화면에는 첫 번째 점이 틀렸다고 뜹니다 —
 * 아이 눈에는 바르게 찍은 점이 틀렸다고 나오고, 덧붙인 점은 맞았다고 나옵니다.
 * 채점을 못 믿게 되는 순간입니다.
 *
 * 사람은 언제나 **뒤에 하나 더 붙였다**고 읽습니다. 그 자리에 표시를 옮깁니다.
 *
 * 옮기는 것은 **같은 글자끼리뿐**이라 무엇이 틀렸는지는 하나도 바뀌지 않습니다.
 * 점수도, 오류 유형도, 오답노트도 그대로입니다. 짚는 자리만 옮깁니다.
 */
function shiftGapsRight(columns: Column[]): Column[] {
  const out = [...columns];

  for (let i = 0; i < out.length; i += 1) {
    const gap = out[i];
    if (gap.kind !== 'extra' && gap.kind !== 'missing') continue;

    let at = i;
    while (at + 1 < out.length) {
      const next = out[at + 1];
      if (next.kind !== 'same') break;

      const sameLetter =
        gap.kind === 'extra' ? gap.input === next.input : gap.answer === next.answer;
      if (!sameLetter) break;

      out[at] = next;
      out[at + 1] = gap;
      at += 1;
    }
  }

  return out;
}

/** 대체(sub) 한 쌍이 어떤 유형의 오류인지 판정합니다. */
function classifySubstitution(answerCh: string, inputCh: string): ErrorType {
  const da = decompose(answerCh);
  const db = decompose(inputCh);

  if (da && db) {
    const sameCho = da.cho === db.cho;
    const sameJung = da.jung === db.jung;
    const sameJong = da.jong === db.jong;

    if (sameCho && sameJung && !sameJong) return 'batchim';
    if (sameCho && sameJong && !sameJung) return 'vowel';
    if (sameJung && sameJong && !sameCho) return 'consonant';
    return 'letter';
  }

  if (isPunctuation(answerCh) || isPunctuation(inputCh)) return 'punct';
  return 'letter';
}

/** 표시 우선순위 — 아이에게 가장 먼저 보여줄 오류부터. */
const TYPE_ORDER: ErrorType[] = [
  'batchim',
  'vowel',
  'consonant',
  'spacing',
  'punct',
  'letter',
];

/**
 * 받아쓰기 한 문장을 채점합니다.
 *
 * @param rawAnswer 정답 문장 (부모가 등록한 원문)
 * @param rawInput  아이가 입력한 문장
 */
export function grade(rawAnswer: string, rawInput: string): GradeResult {
  const answer = normalize(rawAnswer);
  const input = normalize(rawInput);

  if (answer === input) {
    return {
      correct: true,
      answer,
      input,
      errorTypes: [],
      columns: Array.from(answer).map((ch) => ({
        kind: 'same' as const,
        input: ch,
        answer: ch,
      })),
      batchimDetails: [],
    };
  }

  const ops = align(answer, input);
  const types = new Set<ErrorType>();
  const columns: Column[] = [];
  const batchimDetails: Array<{ answer: string; input: string }> = [];

  for (const op of ops) {
    switch (op.type) {
      case 'eq':
        columns.push({ kind: 'same', input: op.input, answer: op.answer });
        break;

      case 'sub': {
        const error = classifySubstitution(op.answer, op.input);
        types.add(error);
        if (error === 'batchim') {
          batchimDetails.push({ answer: op.answer, input: op.input });
        }
        columns.push({
          kind: 'diff',
          input: op.input,
          answer: op.answer,
          error,
        });
        break;
      }

      case 'del':
        // 정답에는 있는데 아이가 쓰지 않음
        if (op.answer === ' ') {
          types.add('spacing');
          columns.push({ kind: 'needSpace' });
        } else {
          types.add(isPunctuation(op.answer) ? 'punct' : 'letter');
          columns.push({ kind: 'missing', answer: op.answer });
        }
        break;

      case 'ins':
        // 아이가 더 쓴 것
        if (op.input === ' ') {
          types.add('spacing');
          columns.push({ kind: 'extraSpace' });
        } else {
          types.add(isPunctuation(op.input) ? 'punct' : 'letter');
          columns.push({ kind: 'extra', input: op.input });
        }
        break;
    }
  }

  const errorTypes = TYPE_ORDER.filter((t) => types.has(t));

  return {
    correct: false,
    answer,
    input,
    errorTypes,
    // 무엇이 틀렸는지는 위에서 다 정해졌습니다. 여기서는 짚는 자리만 다듬습니다.
    columns: shiftGapsRight(columns),
    batchimDetails,
  };
}

/**
 * 세트 전체 점수를 계산합니다. 반올림된 백분율.
 * 빈 배열이면 0을 반환합니다(0으로 나누기 방지).
 */
export function scoreOf(results: Array<{ correct: boolean }>): number {
  if (results.length === 0) return 0;
  const correct = results.filter((r) => r.correct).length;
  return Math.round((correct / results.length) * 100);
}
