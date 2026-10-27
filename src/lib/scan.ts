/**
 * 사진으로 넣은 문장의 「확인할 곳」과 「급 나누기」.
 *
 * 화면(SetForm)·서버(/api/ocr, /api/sets)가 함께 씁니다. 네트워크도 DB 도 없는 순수 로직이라
 * 테스트로 지킵니다 — 여기가 어긋나면 「3번을 고쳤어요」가 엉뚱한 줄을 가리키고,
 * 「되돌리기」가 **다른 문장을 덮어씁니다.** 그 문장이 그대로 채점 기준이 됩니다.
 */

/** AI가 고쳐 적은 곳. 부모가 되돌릴 수 있도록 원래 읽은 값도 함께 둡니다. */
export interface ScanCorrection {
  index: number;
  from: string;
  to: string;
  why: string;
}

/** AI가 확신하지 못한 곳. 고치지는 않았지만 부모가 봐야 합니다. */
export interface ScanUncertain {
  index: number;
  why: string;
}

export interface ScanReview {
  corrections: ScanCorrection[];
  uncertain: ScanUncertain[];
}

export const EMPTY_REVIEW: ScanReview = { corrections: [], uncertain: [] };

/** 문제지의 「3급」 같은 묶음. `start` 는 그 묶음 첫 문장의 자리입니다. */
export interface ScanGroup {
  label: string;
  start: number;
}

/** 묶음 하나를 떼어 낸 것. `review` 의 자리 번호는 이 묶음 안에서 셉니다. */
export interface ScanPart {
  /** 제목이 안 찍힌 묶음은 빈 문자열입니다 */
  label: string;
  sentences: string[];
  review: ScanReview;
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/* ------------------------------------------------------------ 읽어 들이기 */

/**
 * AI·화면이 보낸 확인할 곳을 다듬습니다. 자리 번호가 문장 범위 밖이면 버립니다.
 *
 * 서버가 저장할 때(`review_notes`)도 같은 함수를 거칩니다 — 화면이 보낸 것을 그대로
 * 담으면 나중에 확인 화면이 없는 줄을 가리킵니다.
 */
export function readReview(raw: unknown, count: number): ScanReview {
  const obj = (raw ?? {}) as { corrections?: unknown; uncertain?: unknown };
  const corrections = (Array.isArray(obj.corrections) ? obj.corrections : [])
    .map((item) => {
      const c = (item ?? {}) as Record<string, unknown>;
      return {
        index: Number(c.index),
        from: clip(c.from, 200),
        to: clip(c.to, 200),
        why: clip(c.why, 120),
      };
    })
    .filter(
      (c) =>
        Number.isInteger(c.index) &&
        c.index >= 0 &&
        c.index < count &&
        c.to.length > 0 &&
        // 바뀐 게 없으면 알릴 것도 없습니다.
        c.from !== c.to,
    )
    .slice(0, 60);
  const uncertain = (Array.isArray(obj.uncertain) ? obj.uncertain : [])
    .map((item) => {
      const u = (item ?? {}) as Record<string, unknown>;
      return { index: Number(u.index), why: clip(u.why, 120) };
    })
    .filter((u) => Number.isInteger(u.index) && u.index >= 0 && u.index < count)
    .slice(0, 60);
  return { corrections, uncertain };
}

/**
 * AI가 준 묶음을 다듬습니다. 자리 순으로 줄 세우고, 같은 자리·범위 밖은 버립니다.
 *
 * **첫 묶음이 0번에서 시작하지 않으면 그 앞을 「제목 없는 묶음」으로 남깁니다.**
 * 급수표를 찍으면 위쪽에 앞 급의 끝자락이 제목 없이 걸리기 쉽습니다 —
 * 부모가 「다른 급 문제가 같이 찍혔다」고 한 게 바로 그것이라, 첫 묶음에 붙이면 안 됩니다.
 */
export function readGroups(raw: unknown, count: number): ScanGroup[] {
  if (!Array.isArray(raw) || count === 0) return [];
  const seen = new Set<number>();
  const groups = raw
    .map((item) => {
      const g = (item ?? {}) as Record<string, unknown>;
      return { label: clip(g.label, 20), start: Number(g.start) };
    })
    .filter((g) => Number.isInteger(g.start) && g.start >= 0 && g.start < count)
    .sort((a, b) => a.start - b.start)
    .filter((g) => (seen.has(g.start) ? false : (seen.add(g.start), true)));

  if (groups.length > 0 && groups[0].start > 0) groups.unshift({ label: '', start: 0 });
  return groups;
}

/* ------------------------------------------------------------ 급 나누기 */

/** 확인할 곳 중 [from, to) 에 든 것만 남기고, 자리를 `from` 기준으로 옮깁니다. */
function sliceReview(review: ScanReview, from: number, to: number): ScanReview {
  const inside = (i: number) => i >= from && i < to;
  return {
    corrections: review.corrections
      .filter((c) => inside(c.index))
      .map((c) => ({ ...c, index: c.index - from })),
    uncertain: review.uncertain
      .filter((u) => inside(u.index))
      .map((u) => ({ ...u, index: u.index - from })),
  };
}

/**
 * 사진 한 장을 묶음별로 나눕니다. 묶음이 둘 미만이면 통째로 하나를 돌려줍니다 —
 * 그때는 고를 것이 없으니 화면이 예전처럼 곧바로 붙입니다.
 */
export function splitScan(
  sentences: string[],
  groups: ScanGroup[],
  review: ScanReview,
): ScanPart[] {
  if (groups.length < 2) {
    return [{ label: groups[0]?.label ?? '', sentences, review }];
  }
  return groups
    .map((g, i) => {
      const end = groups[i + 1]?.start ?? sentences.length;
      return {
        label: g.label,
        sentences: sentences.slice(g.start, end),
        review: sliceReview(review, g.start, end),
      };
    })
    .filter((p) => p.sentences.length > 0);
}

/* ------------------------------------------------------- 목록이 바뀔 때 */

/** 목록 뒤에 붙일 때. 붙이기 전 문장 수만큼 자리를 밉니다. */
export function shiftReview(review: ScanReview, offset: number): ScanReview {
  return {
    corrections: review.corrections.map((c) => ({ ...c, index: c.index + offset })),
    uncertain: review.uncertain.map((u) => ({ ...u, index: u.index + offset })),
  };
}

/**
 * 문장 하나를 지웠을 때. 그 줄의 표시는 버리고 뒤쪽 표시는 한 칸씩 당깁니다.
 *
 * 이게 없으면 위쪽 군더더기 줄을 지우는 순간 「4번을 고쳤어요」가 원래 5번이던 줄을
 * 가리키고, 「되돌리기」가 **그 줄을 덮어씁니다.**
 */
export function reviewAfterRemove(review: ScanReview, index: number): ScanReview {
  const move = (i: number) => (i > index ? i - 1 : i);
  return {
    corrections: review.corrections
      .filter((c) => c.index !== index)
      .map((c) => ({ ...c, index: move(c.index) })),
    uncertain: review.uncertain
      .filter((u) => u.index !== index)
      .map((u) => ({ ...u, index: move(u.index) })),
  };
}

/** ▲▼ 로 두 줄을 맞바꿨을 때. 표시도 줄을 따라갑니다. */
export function reviewAfterSwap(review: ScanReview, a: number, b: number): ScanReview {
  const move = (i: number) => (i === a ? b : i === b ? a : i);
  return {
    corrections: review.corrections.map((c) => ({ ...c, index: move(c.index) })),
    uncertain: review.uncertain.map((u) => ({ ...u, index: move(u.index) })),
  };
}

/** 확인할 곳이 있는 줄 번호들. 목록에서 그 줄을 붉게 짚는 데 씁니다. */
export function flaggedLines(review: ScanReview): Set<number> {
  return new Set([
    ...review.corrections.map((c) => c.index),
    ...review.uncertain.map((u) => u.index),
  ]);
}

/**
 * 흐린 줄이 많은가. 그러면 하나씩 고치는 것보다 **다시 가까이 찍는 편이 빠릅니다.**
 * 세 줄도 안 되는 사진에서 한 줄이 흐린 것은 고치면 끝이라 따지지 않습니다.
 */
export const BLURRY_RATIO = 0.3;
export function isBlurry(review: ScanReview, count: number): boolean {
  if (count < 3) return false;
  const lines = new Set(review.uncertain.map((u) => u.index));
  return lines.size / count >= BLURRY_RATIO;
}

/* ------------------------------------------------------- 확인할 차례 */

/**
 * 세트 이름에서 급 번호를 읽습니다. 「3급」「3급 받아쓰기」→ 3. 없으면 무한대(맨 뒤).
 *
 * 따로 칸을 두지 않았습니다. 급수표는 1급부터 차례로 시험을 보고,
 * 한꺼번에 만든 세트의 이름이 곧 그 급이라 이름이 이미 답을 갖고 있습니다.
 * 부모가 이름을 바꿔 숫자가 사라지면 만든 순서로 내려갑니다.
 */
export function levelOf(name: string): number {
  const m = name.match(/(\d+)\s*급/) ?? name.match(/(\d+)/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

/** 확인 전 세트들을 확인할 차례대로. 급 번호 → 만든 순서. */
export function reviewOrder<T extends { name: string; createdAt: string }>(sets: T[]): T[] {
  return [...sets].sort(
    (a, b) => levelOf(a.name) - levelOf(b.name) || a.createdAt.localeCompare(b.createdAt),
  );
}

/** 한꺼번에 만들 때의 세트 이름. 제목이 안 찍힌 묶음은 기본 이름에 번호를 붙입니다. */
export function partName(part: ScanPart, index: number, fallback: string): string {
  return part.label || `${fallback} (${index + 1})`;
}
