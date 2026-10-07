import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readJson, requireUser } from '@/lib/api';
import { LOCK_RESET_COOKIE, lockResetApplies } from '@/lib/parent-lock';
import { verifyPin } from '@/lib/pin';
import {
  grantParentGrace,
  hasParentGrace,
  readParentPinHash,
  setProfileCookies,
} from '@/lib/profile-server';

/**
 * 보호자 화면으로 전환.
 *
 * 잠금을 걸어 두었으면 PIN을 묻습니다.
 * 보호자 화면은 아이 프로필·보이는 문제·기록을 바꾸는 곳이라 보호자만 들어오게 합니다.
 * (정답 문장 열람을 막는 것도 같은 문이 해 줍니다 — 세트를 열면 정답이 그대로 보이니까요.)
 *
 * 한 번 통과하면 30분 동안은 다시 묻지 않습니다.
 * 문제를 넣다가 아이 화면을 확인하고 돌아오는 걸음이 잦은데,
 * 그때마다 물으면 부모가 잠금을 꺼 버립니다.
 *
 * **비밀번호를 잊어 다시 로그인한 사람은 한 번 건너뜁니다.** 아이는 계정 비밀번호를 모르므로
 * 다시 로그인한 것이 곧 본인 확인입니다. 그 상태에서 설정의 「바꾸기」로 새 번호를 정합니다.
 *
 * 마지막에 고른 자녀는 그대로 둡니다. 리포트에서 누구를 볼지 기본값으로 쓰려고요.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const pinHash = await readParentPinHash();

  // 표시는 쓰든 안 쓰든 한 번 보면 지웁니다. 남겨 두면 다음 잠금까지 건너뛰게 됩니다.
  const store = await cookies();
  const resetMark = store.get(LOCK_RESET_COOKIE)?.value;
  if (resetMark !== undefined) store.delete(LOCK_RESET_COOKIE);
  const reloggedIn = lockResetApplies(resetMark, auth.user.last_sign_in_at);

  if (pinHash && reloggedIn) {
    await grantParentGrace();
  } else if (pinHash && !(await hasParentGrace())) {
    const body = await readJson<{ pin?: unknown }>(request);
    const pin = typeof body?.pin === 'string' ? body.pin : '';

    if (!pin) {
      // 화면이 잠금 여부를 몰랐던 경우 — 입력판을 띄우라고 알려 줍니다.
      return NextResponse.json({ error: '보호자 비밀번호가 필요해요.', locked: true }, { status: 401 });
    }
    if (!(await verifyPin(pin, pinHash))) {
      return NextResponse.json(
        { error: '비밀번호가 달라요. 다시 눌러 주세요.', locked: true },
        { status: 403 },
      );
    }
    await grantParentGrace();
  }

  await setProfileCookies({ view: 'parent' });
  return NextResponse.json({ ok: true });
}
