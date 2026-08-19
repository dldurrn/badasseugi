import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { badRequest, normalizeNickname, readJson, requireUser } from '@/lib/api';
import { isAllowedAvatar } from '@/lib/avatars';
import { hashPin, isValidPin } from '@/lib/pin';
import { ACTIVE_CHILD_COOKIE, VIEW_COOKIE } from '@/lib/profile';

/**
 * 자녀 프로필 고치기·지우기. 보호자 화면에서만 부릅니다.
 *
 * `pin` 값의 뜻을 셋으로 나눕니다.
 *   없음(undefined) = 그대로 둔다 / null = 잠금을 없앤다 / "1234" = 새로 정한다
 */

interface UpdateBody {
  nickname?: unknown;
  avatar?: unknown;
  pin?: unknown;
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await params;

  const body = await readJson<UpdateBody>(request);
  if (!body) return badRequest('입력을 읽지 못했어요.');

  const patch: Record<string, unknown> = {};

  if (body.nickname !== undefined) {
    const nickname = normalizeNickname(body.nickname);
    if (!nickname) return badRequest('별명을 1~20자로 적어 주세요.');
    patch.nickname = nickname;
  }

  if (body.avatar !== undefined) {
    if (!isAllowedAvatar(body.avatar)) return badRequest('그림을 다시 골라 주세요.');
    patch.avatar = body.avatar;
  }

  if (body.pin !== undefined) {
    if (body.pin === null || body.pin === '') {
      patch.pin_hash = null;
    } else if (typeof body.pin === 'string' && isValidPin(body.pin)) {
      patch.pin_hash = await hashPin(body.pin);
    } else {
      return badRequest('비밀번호는 숫자 4자리로 정해 주세요.');
    }
  }

  if (Object.keys(patch).length === 0) return badRequest('바꿀 내용이 없어요.');

  // 남의 가족 프로필이면 RLS가 걸러 내므로 여기서는 결과가 비었는지만 봅니다.
  const { data, error } = await supabase
    .from('children')
    .update(patch)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[children] 수정 실패', error);
    return NextResponse.json({ error: '고치지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: '프로필을 찾지 못했어요.' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await params;

  // 기록·오답노트·보상까지 함께 지워집니다(스키마의 on delete cascade).
  const { data, error } = await supabase
    .from('children')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[children] 삭제 실패', error);
    return NextResponse.json({ error: '지우지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: '프로필을 찾지 못했어요.' }, { status: 404 });

  // 지운 프로필이 지금 선택되어 있으면 선택을 풀어 줍니다.
  const store = await cookies();
  if (store.get(ACTIVE_CHILD_COOKIE)?.value === id) {
    store.delete(ACTIVE_CHILD_COOKIE);
    store.delete(VIEW_COOKIE);
  }

  return NextResponse.json({ ok: true });
}
