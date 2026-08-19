/**
 * 지금 누가 앱을 쓰고 있는지 — 보호자인지, 어느 자녀인지.
 *
 * 쿠키에 담는 이유: 미들웨어와 서버 컴포넌트가 같은 값을 봐야 하기 때문입니다.
 * httpOnly로 두어 화면 코드에서는 손대지 못하게 하고,
 * 자녀 id가 필요한 화면에는 서버에서 props로 내려줍니다.
 *
 * 이 구분은 '화면을 감추는' 용도입니다(지침 9).
 * 서버 권한 검증은 RLS가 가족 단위로만 하고 있고, 그 이상은 범위 밖입니다.
 */

export const ACTIVE_CHILD_COOKIE = 'bs_child';
export const VIEW_COOKIE = 'bs_view';

/**
 * 보호자 잠금을 방금 통과했다는 표시.
 *
 * 문제를 넣다가 아이 화면을 확인하고 다시 돌아오는 일이 잦은데,
 * 그때마다 PIN을 묻으면 부모가 잠금을 꺼 버립니다.
 * 30분만 기억해서 "한 번 확인하면 그 작업 동안은 묻지 않는" 정도로 둡니다.
 */
export const PARENT_GRACE_COOKIE = 'bs_parent_ok';
export const PARENT_GRACE_MAX_AGE = 60 * 30;

/** 90일. 매번 프로필을 고르게 하면 아이가 앱을 못 엽니다. */
export const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/** 한 가족이 만들 수 있는 프로필 수. 실수로 늘어나는 것을 막는 정도의 상한입니다. */
export const MAX_CHILDREN = 6;

/**
 * PIN 길이는 화면(입력판)과 서버(검증)가 같은 값을 봐야 합니다.
 * 해시 함수가 있는 `pin.ts`는 node:crypto를 쓰므로 화면에서 불러올 수 없어
 * 양쪽이 함께 쓰는 값만 여기에 둡니다.
 */
export const PIN_LENGTH = 4;

/** 별명 길이 상한. DB 제약(children.nickname)과 같은 값으로 맞춰 둡니다. */
export const NICKNAME_MAX = 20;

/** 4자리 숫자인지. 아이가 외우기 쉬운 길이로 고정합니다. */
export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export type ViewMode = 'parent' | 'child';

/** 쿠키가 없으면 아직 아무도 고르지 않은 상태(null)입니다. */
export function parseView(raw: string | undefined | null): ViewMode | null {
  return raw === 'parent' || raw === 'child' ? raw : null;
}

export interface ProfileCookieState {
  view: ViewMode | null;
  childId: string | null;
}

/** 프로필 선택 화면으로 보내야 하는 상태인지. 미들웨어와 화면이 같은 규칙을 쓰게 모아 둡니다. */
export function needsProfileSelection({ view, childId }: ProfileCookieState): boolean {
  if (!view) return true;
  return view === 'child' && !childId;
}
