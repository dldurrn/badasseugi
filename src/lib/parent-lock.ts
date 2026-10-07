/**
 * 보호자 잠금을 「기본으로」 거는 규칙 — 순수 함수만.
 *
 * **기본 비밀번호는 둘 수 없습니다.** 미리 정해 둔 번호는 아이도 아는 번호라 잠금이 아닙니다.
 * 그래서 「기본으로 잠금」은 **보호자 화면에 처음 들어오는 자리에서 번호를 정하게 하는 것**입니다.
 * 별도 화면이 아니라 입구에서 정하므로 걸음이 늘지 않습니다.
 */

/** 「나중에 할게요」를 누른 날(서울 기준 YYYY-MM-DD)을 기기에 적어 두는 자리 */
export const LOCK_LATER_KEY = 'bs_lock_later';

/** 비밀번호를 잊어 다시 로그인하러 나갈 때 남기는 표시 */
export const LOCK_RESET_COOKIE = 'bs_lock_reset';
export const LOCK_RESET_MAX_AGE = 60 * 60;

/**
 * 입구에서 비밀번호를 정하라고 물을까.
 *
 * - 이미 잠겨 있으면 물을 것이 없습니다(그때는 입력을 받습니다).
 * - 「나중에」는 **오늘 하루만** 미룹니다. 영영 안 묻으면 기본으로 잠그는 뜻이 사라지고,
 *   들어올 때마다 물으면 부모가 짜증이 나서 입구를 피합니다.
 * - 날짜가 다르면 다시 묻습니다. 어제 미뤘든 한 달 전에 미뤘든 같습니다.
 */
export function shouldAskToSetLock(opts: {
  locked: boolean;
  /** 마지막으로 「나중에」를 누른 날. 없으면 null */
  laterOn: string | null;
  /** 오늘(서울 기준) */
  today: string;
}): boolean {
  if (opts.locked) return false;
  return opts.laterOn !== opts.today;
}

/**
 * 비밀번호를 잊어서 다시 로그인한 사람이 확인을 건너뛰어도 되는가.
 *
 * 아이는 계정 비밀번호를 모르므로 **다시 로그인한 것이 곧 본인 확인**입니다.
 * 다만 표시(쿠키)만 보면 안 됩니다 — 아이가 그 주소만 불러 표시를 남기고
 * 로그아웃 없이 들어오려 할 수 있으니, **표시를 남긴 뒤에 로그인했는가**까지 봅니다.
 *
 * @param mark 표시를 남긴 때(ms, 문자열)
 * @param lastSignInAt 이 계정이 마지막으로 로그인한 때(ISO)
 */
export function lockResetApplies(
  mark: string | undefined | null,
  lastSignInAt: string | undefined | null,
): boolean {
  if (!mark || !lastSignInAt) return false;
  const marked = Number(mark);
  const signedIn = Date.parse(lastSignInAt);
  if (!Number.isFinite(marked) || !Number.isFinite(signedIn)) return false;
  return signedIn > marked;
}
