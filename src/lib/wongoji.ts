/**
 * 원고지 칸 규칙.
 *
 * 원고지는 **보이는 방식**일 뿐이고, 저장·채점에 쓰는 것은 언제나 원래 문장입니다.
 * 둘 사이를 오가는 변환을 여기 한 곳에 모읍니다.
 *
 * 이렇게 갈라 두는 이유는 쉼표 때문입니다.
 * 원고지에서 쉼표 뒤는 한 칸을 비우지 않는데, 원래 문장에는 공백이 있습니다.
 * 격자를 그대로 이어 붙이면 "호로록,한 입"이 되어
 * 아이가 바르게 쓰고도 띄어쓰기가 틀렸다는 채점을 받습니다.
 *
 * 덕분에 아이가 원고지 규칙을 지키든 안 지키든 채점은 같아집니다.
 *   호|로|록|,|한   → "호로록, 한"   (규칙대로 붙여 쓴 경우)
 *   호|로|록|,|_|한 → "호로록, 한"   (그냥 한 칸 띄운 경우)
 * 규칙을 몰라서 틀리는 일은 없어야 합니다. 우리가 가르치려는 건 맞춤법이지 원고지 사용법이 아닙니다.
 */

/** 한 줄 칸 수. 학교 문제지와 맞춰 15칸입니다. */
export const WONGOJI_COLS = 15;

/**
 * 처음에 깔아 두는 줄 수.
 *
 * 한 줄입니다. 내장 문장 200개를 재 보니 중앙값이 7칸이고 열에 아홉은 한 줄에 들어갑니다.
 * 넉넉하게 네 줄을 깔아 두면 빈 칸이 마흔 개씩 남아 휑하고, 확인 버튼도 저 아래로 밀립니다.
 * 모자라면 `growingGrid`가 그때 늘려 줍니다 —
 * 늘어나는 기준이 정답 길이가 아니라 **아이가 쓴 만큼**이라 글자 수가 새지 않습니다.
 */
export const WONGOJI_MIN_ROWS = 1;

/** 넘칠 때 늘어나는 한계. 문장 상한(200자)을 담고도 남습니다. */
export const WONGOJI_MAX_ROWS = 14;

/** 빈 칸. 띄어쓰기이면서 아직 안 쓴 자리이기도 합니다. */
export const EMPTY = '';

/**
 * 뒤 칸을 비우지 않는 문장부호.
 *
 * 물음표·느낌표는 여기 넣지 않습니다 — 원고지에서 이 둘은 뒤를 한 칸 띄웁니다.
 * 원래 문장에도 공백이 있으니 그대로 두면 저절로 맞습니다.
 */
const NO_SPACE_AFTER = new Set([',', '.', '…']);

/**
 * 앞에 공백이 붙을 수 없는 글자들.
 *
 * 닫는 따옴표·괄호와 뒤따르는 부호가 여기 듭니다.
 * `"고마워." 하고` 처럼 마침표 다음에 닫는 따옴표가 오는 경우,
 * 이 목록이 없으면 `"고마워. "` 로 벌어져 원문과 달라집니다.
 * 말줄임표 `……`가 `… …`로 벌어지는 것도 같은 이유로 여기서 막힙니다.
 */
const NO_SPACE_BEFORE = new Set([
  '"', "'", ')', ']', '}', '」', '』', '》', '〉', '›', '»',
  ',', '.', '…', '?', '!', ':', ';',
]);

/** 채점 엔진과 같은 방식으로 다듬습니다. 여기서 어긋나면 왕복이 깨집니다. */
function tidy(text: string): string {
  return (text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * 문장을 원고지 칸으로 폅니다.
 *
 * 줄 첫 칸에 오는 띄어쓰기를 없애는 규칙은 **일부러 넣지 않았습니다.**
 * 되돌릴 때 "줄 끝에서 잘린 낱말"과 "띄어쓴 낱말"을 구분할 수 없어져,
 * 아이가 쓴 것을 문장으로 되돌리는 순간 띄어쓰기가 사라집니다.
 * 보기 좋자고 채점을 틀리게 할 수는 없습니다.
 */
export function toCells(text: string): string[] {
  const s = tidy(text);
  const cells: string[] = [];

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];

    if (ch === ' ') {
      cells.push(EMPTY);
      continue;
    }

    cells.push(ch);

    // 마침표·쉼표 바로 뒤의 공백은 칸을 차지하지 않습니다.
    if (NO_SPACE_AFTER.has(ch) && s[i + 1] === ' ') i += 1;
  }

  return cells;
}

/**
 * 원고지 칸을 문장으로 되돌립니다.
 *
 * 마침표·쉼표 다음 칸에 글자가 바로 붙어 있으면, 원래 문장에 있던 공백을 되살립니다.
 */
export function toText(cells: string[]): string {
  let out = '';

  for (let i = 0; i < cells.length; i += 1) {
    const ch = cells[i];

    if (ch === EMPTY) {
      out += ' ';
      continue;
    }

    out += ch;

    const next = cells[i + 1];
    if (
      NO_SPACE_AFTER.has(ch) &&
      next !== undefined &&
      next !== EMPTY &&
      !NO_SPACE_BEFORE.has(next)
    ) {
      out += ' ';
    }
  }

  return tidy(out);
}

/**
 * 아이가 쓰는 중의 칸.
 *
 * `toCells`와 달리 **다듬지 않고 누른 대로 옮깁니다.**
 *
 * `toCells`는 채점을 위해 끝의 공백을 잘라 내는데, 그 함수를 쓰는 화면에 그대로 썼더니
 * 스페이스를 눌러도 칸이 생기지 않아 커서가 제자리에 머물렀습니다.
 * 아이 눈에는 띄어쓰기가 안 먹는 것으로 보입니다.
 *
 * 쉼표 뒤 공백도 흡수하지 않습니다. 원고지 규칙을 아는 아이는 붙여 쓸 것이고
 * 모르는 아이는 한 칸 띄울 텐데, `toText`가 어느 쪽이든 같은 문장으로 되돌립니다.
 * 스페이스를 두 번 눌러도 채점은 `normalize()`가 한 칸으로 봅니다.
 */
export function toWritingCells(text: string): string[] {
  return Array.from((text ?? '').normalize('NFC')).map((ch) =>
    ch.trim() === '' ? EMPTY : ch,
  );
}

/**
 * 지금 쓰고 있는 칸이 어디인지.
 *
 * 조합 중이면 **마지막 글자가 놓인 칸**입니다.
 * `ㄱ → 가 → 각`은 아직 확정된 글자가 아닌데 이걸 다 쓴 것으로 치면
 * 커서만 먼저 다음 칸으로 가서, 쓰는 자리와 표시가 어긋납니다.
 */
export function writingCursor(cellCount: number, composing: boolean): number {
  if (composing && cellCount > 0) return cellCount - 1;
  return cellCount;
}

/** 격자를 채우고 남는 자리는 빈 칸으로 둡니다. 늘 같은 크기로 보이게 하려는 것입니다. */
export function padToGrid(
  cells: string[],
  minRows = WONGOJI_MIN_ROWS,
  cols = WONGOJI_COLS,
): string[] {
  const needed = Math.ceil(cells.length / cols);
  const rows = Math.min(WONGOJI_MAX_ROWS, Math.max(minRows, needed));
  const total = rows * cols;

  const grid = cells.slice(0, total);
  while (grid.length < total) grid.push(EMPTY);
  return grid;
}

/**
 * 쓰는 중에 쓰는 격자.
 *
 * 한 줄로 시작해서, **지금 줄을 다 채웠을 때만** 다음 줄이 생깁니다.
 * 미리 여러 줄을 깔아 두지 않는 이유는 빈 줄이 "여기까지 써야 하나?" 하고 읽히기 때문입니다.
 */
export function growingGrid(cells: string[], cols = WONGOJI_COLS): string[] {
  const used = Math.max(1, Math.ceil(cells.length / cols));
  const rowIsFull = cells.length > 0 && cells.length % cols === 0;
  return padToGrid(cells, rowIsFull ? used + 1 : used, cols);
}
