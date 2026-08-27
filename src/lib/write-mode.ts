/**
 * 쓰기 모드 — 원고지에 쓸지, 그냥 한 줄에 쓸지.
 *
 * **값은 서버에 있습니다**(src/lib/settings.ts). 여기에는 타입과 기본값만 둡니다.
 *
 * 예전에는 기기에 저장했습니다 — 형제가 같은 화면을 보는 쪽이 덜 헷갈린다는 이유였는데,
 * 실제로는 형과 동생이 편한 방식이 달랐고 부모 휴대폰에서 정한 것이
 * 아이 패드로 넘어가지도 않았습니다. 이 전제는 버렸습니다.
 *
 * 세트 만들기의 보기 방식(SetView)은 그대로 기기에 둡니다 —
 * 그건 아이의 설정이 아니라 부모가 지금 문장을 어떻게 훑어보고 싶은가입니다.
 */

export type WriteMode = 'wongoji' | 'plain';

/** 세트 만들기에서 문장 목록을 보는 방식 */
export type SetView = 'plain' | 'wongoji';

const VIEW_KEY = 'badasseugi:set-view';

/**
 * 기본은 원고지입니다.
 *
 * 입력은 평범한 입력칸 하나가 받고 격자에 그리기만 하므로,
 * 한글 조합이 기기마다 다르게 굴 걱정이 없습니다.
 * 아이가 불편하면 설정에서 「그냥 쓰기」로 바꿉니다.
 */
export const DEFAULT_WRITE_MODE: WriteMode = 'wongoji';

/** 세트 만들기는 고치는 일이 먼저라 일반 보기로 시작합니다. */
export function readSetView(): SetView {
  if (typeof window === 'undefined') return 'plain';
  return window.localStorage.getItem(VIEW_KEY) === 'wongoji' ? 'wongoji' : 'plain';
}

export function saveSetView(view: SetView): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VIEW_KEY, view);
}
