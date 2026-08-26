import type { Column, ErrorType } from './grading';
import { WONGOJI_COLS, absorbsFollowingSpace } from './wongoji';

/**
 * 채점표를 원고지 칸에 앉힙니다.
 *
 * 아이가 원고지에 썼으면 채점도 원고지로 봐야 합니다.
 * 낱낱의 칸을 띄엄띄엄 늘어놓으면 **몇 번째 칸에서 틀렸는지**를 셀 수가 없습니다.
 * 「콧잔등에」의 셋째 칸이 틀렸다는 것을 알아야 다음에 그 칸을 다시 씁니다.
 *
 * 규칙은 쓰는 화면과 같아야 합니다 —
 * 띄어쓰기는 한 칸을 먹고, 쉼표·마침표 뒤는 칸을 비우지 않습니다.
 * 여기서만 다르게 세면 아이가 바르게 쓰고도 칸을 세어 보게 됩니다.
 *
 * 칸 하나에 위(내가 쓴 것)/아래(정답)가 함께 들어갑니다.
 * 편집거리로 맞춘 열을 그대로 칸에 옮기므로, 글자를 빠뜨리거나 더 써도
 * 그 뒤 글자들이 여전히 같은 세로줄에 섭니다.
 */

export type GradeCell =
  /** 맞게 쓴 글자 */
  | { kind: 'same'; input: string; answer: string }
  /** 다르게 쓴 글자 */
  | { kind: 'diff'; input: string; answer: string; error: ErrorType }
  /** 정답에 있는데 안 쓴 글자 */
  | { kind: 'missing'; answer: string }
  /** 정답에 없는데 더 쓴 글자 */
  | { kind: 'extra'; input: string }
  /** 맞게 띄운 자리 — 위아래 모두 빈 칸 */
  | { kind: 'blank' }
  /** 정답은 여기를 비웠는데 아이가 안 비움 (∨ 띄어요) */
  | { kind: 'needSpace' }
  /** 아이가 비웠는데 정답에는 없는 칸 (✕ 붙여요) */
  | { kind: 'extraSpace' }
  /** 줄을 채우는 빈 칸. 아무 뜻도 없는, 남은 종이입니다. */
  | { kind: 'pad' };

/** 그 열이 정답 쪽에 내놓는 글자. 없으면 null(정답에 없는 칸). */
function answerCharOf(column: Column): string | null {
  switch (column.kind) {
    case 'same':
    case 'diff':
      return column.answer;
    case 'missing':
      return column.answer;
    case 'needSpace':
      // 정답에는 공백이 있는데 아이가 안 쓴 자리입니다.
      return ' ';
    case 'extra':
    case 'extraSpace':
      // 아이만 쓴 것이라 정답 쪽 자리가 없습니다.
      return null;
  }
}

/**
 * 채점 열을 원고지 칸으로 옮깁니다.
 *
 * `pad`로 마지막 줄을 채웁니다. 종이 원고지는 문장이 끝나도 칸이 이어지니까요.
 * 칸을 세는 눈이 줄 끝에서 끊기지 않아야 「몇째 줄 몇째 칸」이 눈에 잡힙니다.
 */
export function toGradeCells(columns: Column[], cols = WONGOJI_COLS): GradeCell[] {
  const out: GradeCell[] = [];

  /*
    바로 앞 칸이 정답 쪽에 내놓은 글자.

    쉼표 뒤 공백을 삼키려면 이게 필요합니다.
    아이가 더 쓴 글자(`extra`)는 정답 쪽 자리가 없으므로 이 값을 건드리지 않습니다 —
    「고,,빵」처럼 쉼표를 두 번 찍어도 정답 기준으로는 여전히 쉼표 뒤입니다.
  */
  let prevAnswer = '';

  for (const column of columns) {
    // 맞게 띄운 자리
    if (column.kind === 'same' && column.answer === ' ') {
      // 쉼표·마침표 뒤라면 원고지에서 칸을 비우지 않습니다
      if (absorbsFollowingSpace(prevAnswer)) continue;
      out.push({ kind: 'blank' });
      prevAnswer = ' ';
      continue;
    }

    out.push(column as GradeCell);

    const next = answerCharOf(column);
    if (next !== null) prevAnswer = next;
  }

  // 마지막 줄을 남은 종이로 채웁니다
  const remainder = out.length % cols;
  if (remainder !== 0) {
    for (let i = remainder; i < cols; i += 1) out.push({ kind: 'pad' });
  }
  // 아무것도 없어도 한 줄은 그립니다. 빈 종이가 화면에서 사라지면 어색합니다.
  if (out.length === 0) {
    for (let i = 0; i < cols; i += 1) out.push({ kind: 'pad' });
  }

  return out;
}

/**
 * 칸을 줄(15칸)로 끊습니다.
 *
 * 위/아래 두 줄이 한 짝이라 줄마다 따로 그려야 합니다.
 * 전체를 한 격자에 이어 붙이면 「내가 쓴 것」 줄이 전부 지나간 다음에야
 * 「정답」 줄이 나와서, 위아래로 견주는 뜻이 사라집니다.
 */
export function toGradeRows(cells: GradeCell[], cols = WONGOJI_COLS): GradeCell[][] {
  const rows: GradeCell[][] = [];
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));
  return rows;
}
