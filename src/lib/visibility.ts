/**
 * 아이별로 문제 세트 보이기·숨기기 — 순수 규칙.
 *
 * **숨긴 아이만 저장합니다**(`set_hidden`). 행이 없으면 모두에게 보입니다.
 * 그래서 새 세트·새 아이는 아무 처리 없이 기본(보임)이 됩니다.
 */

export const MAX_BULK_SETS = 200;

/** 이 아이에게 숨겨진 세트인가 */
export function isHiddenFor(hiddenFor: readonly string[], childId: string | null): boolean {
  return childId !== null && hiddenFor.includes(childId);
}

/** 한 아이의 숨김 여부만 바꾼 새 목록. 이미 그 상태면 그대로 돌려줍니다 */
export function withHidden(
  hiddenFor: readonly string[],
  childId: string,
  hidden: boolean,
): string[] {
  const has = hiddenFor.includes(childId);
  if (hidden === has) return [...hiddenFor];
  return hidden ? [...hiddenFor, childId] : hiddenFor.filter((id) => id !== childId);
}

/** 이 아이에게 보이는 세트 수 */
export function visibleCount(
  sets: ReadonlyArray<{ hiddenFor: readonly string[] }>,
  childId: string,
): number {
  return sets.filter((s) => !s.hiddenFor.includes(childId)).length;
}

/**
 * 카드 밑에 적는 한 줄. 숨긴 아이가 없으면 null.
 *
 * 체크 모드를 열지 않아도 「누구에게 안 보이는지」가 드러나야 합니다 —
 * 숨겨 놓고 잊으면 아이가 세트가 없어졌다고 말할 때 부모가 이유를 못 찾습니다.
 * 아이가 지워진 뒤에 남은 id 는 이름을 못 찾으므로 건너뜁니다(cascade 로 곧 사라집니다).
 */
export function hiddenLabel(
  hiddenFor: readonly string[],
  children: ReadonlyArray<{ id: string; nickname: string }>,
): string | null {
  const names = children.filter((c) => hiddenFor.includes(c.id)).map((c) => c.nickname);
  if (names.length === 0) return null;
  if (names.length === children.length) return '아무에게도 안 보여요';
  return `${names.join(', ')}에게는 안 보여요`;
}

export interface VisibilityRequest {
  childId: string;
  setIds: string[];
  /** true 면 숨김, false 면 다시 보이게 */
  hidden: boolean;
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 저장 요청 검사. 화면이 보낸 값이라 모양을 믿지 않습니다.
 * 중복 id 는 접고, 한 번에 보내는 개수에 상한을 둡니다.
 */
export function parseVisibilityRequest(raw: unknown): VisibilityRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.childId !== 'string' || !ID.test(body.childId)) return null;
  if (typeof body.hidden !== 'boolean') return null;
  if (!Array.isArray(body.setIds)) return null;

  const setIds = [...new Set(body.setIds)];
  if (setIds.length === 0 || setIds.length > MAX_BULK_SETS) return null;
  if (!setIds.every((id): id is string => typeof id === 'string' && ID.test(id))) return null;

  return { childId: body.childId, setIds, hidden: body.hidden };
}
