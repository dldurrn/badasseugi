import { NextResponse } from 'next/server';
import { badRequest, readJson, requireUser } from '@/lib/api';
import { hashPin, isValidPin } from '@/lib/pin';
import { grantParentGrace, revokeParentGrace } from '@/lib/profile-server';

/**
 * 보호자 잠금 만들기·바꾸기·없애기.
 *
 * 보호자 화면에서만 부를 수 있는 것이 아니라 로그인만 확인합니다.
 * 이 화면에 닿으려면 이미 보호자 화면에 들어와 있어야 하고,
 * 그 문은 이 잠금 자체가 지키고 있기 때문입니다.
 */

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const body = await readJson<{ pin?: unknown }>(request);
  if (typeof body?.pin !== 'string' || !isValidPin(body.pin)) {
    return badRequest('비밀번호는 숫자 4자리로 정해 주세요.');
  }

  const { error } = await supabase
    .from('families')
    .update({ parent_pin_hash: await hashPin(body.pin) })
    .eq('id', user.id);

  if (error) {
    console.error('[parent-pin] 저장 실패', error);
    return NextResponse.json({ error: '저장하지 못했어요.' }, { status: 500 });
  }

  // 방금 정한 사람은 다시 묻지 않습니다.
  await grantParentGrace();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const { error } = await supabase
    .from('families')
    .update({ parent_pin_hash: null })
    .eq('id', user.id);

  if (error) {
    console.error('[parent-pin] 삭제 실패', error);
    return NextResponse.json({ error: '지우지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  await revokeParentGrace();
  return NextResponse.json({ ok: true });
}
