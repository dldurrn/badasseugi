/**
 * 쓰기 모드 — 원고지에 쓸지, 그냥 한 줄에 쓸지.
 *
 * 속도·목소리와 같은 방식으로 **기기에 저장**합니다.
 * 계정이 아니라 기기에 두는 이유는, 같은 기기를 쓰는 형제가 설정을 따로 갖는 것보다
 * 화면이 늘 같은 모습인 쪽이 덜 헷갈리기 때문입니다.
 */

export type WriteMode = 'wongoji' | 'plain';

/** 세트 만들기에서 문장 목록을 보는 방식 */
export type SetView = 'plain' | 'wongoji';

const WRITE_KEY = 'badasseugi:write-mode';
const VIEW_KEY = 'badasseugi:set-view';

/**
 * 기본은 원고지입니다.
 *
 * 입력은 평범한 입력칸 하나가 받고 격자에 그리기만 하므로,
 * 한글 조합이 기기마다 다르게 굴 걱정이 없습니다.
 * 이상하면 세션 화면에서 그 자리에서 바꿀 수 있습니다.
 */
export const DEFAULT_WRITE_MODE: WriteMode = 'wongoji';

export function readWriteMode(): WriteMode {
  if (typeof window === 'undefined') return DEFAULT_WRITE_MODE;
  return window.localStorage.getItem(WRITE_KEY) === 'plain' ? 'plain' : 'wongoji';
}

export function saveWriteMode(mode: WriteMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WRITE_KEY, mode);
}

/** 세트 만들기는 고치는 일이 먼저라 일반 보기로 시작합니다. */
export function readSetView(): SetView {
  if (typeof window === 'undefined') return 'plain';
  return window.localStorage.getItem(VIEW_KEY) === 'wongoji' ? 'wongoji' : 'plain';
}

export function saveSetView(view: SetView): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VIEW_KEY, view);
}
