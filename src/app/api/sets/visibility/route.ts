import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { badRequest, readJson, requireUser } from '@/lib/api';
import { VIEW_COOKIE, parseView } from '@/lib/profile';
import { parseVisibilityRequest } from '@/lib/visibility';

/**
 * 아이별로 문제 세트 보이기·숨기기.
 *
 * 한 번에 여러 세트를 받습니다 — 「전체 해제」가 요청 한 번이어야 하고,
 * 세트 수만큼 쪼개 보내면 중간에 끊겼을 때 반쯤만 바뀝니다.
 *
 * **보호자 화면에서만 받습니다.** 아이가 자기 화면에서 이 주소를 직접 불러
 * 숨겨 둔 세트를 도로 켜거나 다른 아이 것을 바꾸지 못하게 하려는 것입니다.
 * (지침 9 — 화면을 나누는 정도의 경계이고, 엄격한 서버 권한 검증은 아닙니다.)
 * 집이 다른 아이·세트는 RLS 가 한 번 더 막습니다.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  if (parseView((await cookies()).get(VIEW_COOKIE)?.value) !== 'parent') {
    return NextResponse.json({ error: '보호자 화면에서만 바꿀 수 있어요.' }, { status: 403 });
  }

  const body = parseVisibilityRequest(await readJson<unknown>(request));
  if (!body) return badRequest('요청을 읽지 못했어요.');

  // 내 집 아이인지 먼저 확인합니다. RLS 만 믿으면 실패 이유가 500 으로 뭉개집니다.
  const { data: child } = await supabase
    .from('children')
    .select('id')
    .eq('id', body.childId)
    .eq('family_id', user.id)
    .maybeSingle();
  if (!child) return badRequest('아이를 찾지 못했어요.');

  const failed = NextResponse.json(
    { error: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' },
    { status: 500 },
  );

  if (body.hidden) {
    const { error } = await supabase.from('set_hidden').upsert(
      body.setIds.map((setId) => ({ set_id: setId, child_id: body.childId })),
      { onConflict: 'set_id,child_id', ignoreDuplicates: true },
    );
    if (error) {
      console.error('[sets/visibility] 숨기기 실패', error);
      return failed;
    }
  } else {
    const { error } = await supabase
      .from('set_hidden')
      .delete()
      .eq('child_id', body.childId)
      .in('set_id', body.setIds);
    if (error) {
      console.error('[sets/visibility] 다시 보이기 실패', error);
      return failed;
    }
  }

  return NextResponse.json({ ok: true });
}
