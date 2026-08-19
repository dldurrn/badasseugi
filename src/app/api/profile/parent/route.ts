import { NextResponse } from 'next/server';
import { readJson, requireUser } from '@/lib/api';
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
 * 막으려는 것은 리포트를 엿보는 게 아니라 **정답 문장 열람**입니다.
 * 보호자 화면에서는 세트를 열면 정답이 그대로 보이기 때문입니다.
 *
 * 한 번 통과하면 30분 동안은 다시 묻지 않습니다.
 * 문제를 넣다가 아이 화면을 확인하고 돌아오는 걸음이 잦은데,
 * 그때마다 물으면 부모가 잠금을 꺼 버립니다.
 *
 * 마지막에 고른 자녀는 그대로 둡니다. 리포트에서 누구를 볼지 기본값으로 쓰려고요.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const pinHash = await readParentPinHash();

  if (pinHash && !(await hasParentGrace())) {
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
