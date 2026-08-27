import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { badRequest, readJson, requireUser } from '@/lib/api';
import { cleanPatch, toColumns } from '@/lib/settings';

/**
 * 설정 저장.
 *
 * 두 층 중 어디에 쓸지 `scope`가 정합니다.
 *   family — 부모가 정하는 기본값. 아이가 따로 고르지 않았으면 이걸 씁니다.
 *   child  — 지금 고른 아이가 직접 고른 값.
 *
 * **아이는 계정이 없습니다.** 그래서 화면이 테이블을 직접 만지지 않고 여기를 거칩니다.
 * 어느 아이인지는 화면이 보낸 값이 아니라 **쿠키**(`bs_child`)로 정합니다 —
 * 화면이 보낸 id를 믿으면 남의 집 아이 설정을 바꾸라고 보낼 수 있습니다.
 * (RLS가 한 번 더 막아 주지만, 애초에 물어보지 않는 편이 낫습니다.)
 *
 * 보내지 않은 항목은 건드리지 않습니다.
 * `null`을 보내면 「안 고름」으로 되돌립니다 — 그러면 위층 값으로 다시 내려갑니다.
 */

const ACTIVE_CHILD_COOKIE = 'bs_child';

interface Body {
  scope?: unknown;
  rate?: unknown;
  writeMode?: unknown;
  voice?: unknown;
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const body = await readJson<Body>(request);
  if (!body) return badRequest('요청을 읽지 못했어요.');

  const scope = body.scope === 'family' ? 'family' : body.scope === 'child' ? 'child' : null;
  if (!scope) return badRequest('어디에 저장할지 알 수 없어요.');

  const patch = cleanPatch(body);
  if (Object.keys(patch).length === 0) return badRequest('바꿀 것이 없어요.');

  const row = toColumns(patch, scope);

  if (scope === 'family') {
    const { error } = await supabase.from('families').update(row).eq('id', user.id);
    if (error) {
      console.error('[settings] 기본값 저장 실패', error);
      return NextResponse.json(
        { error: '설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  const childId = (await cookies()).get(ACTIVE_CHILD_COOKIE)?.value;
  if (!childId) {
    return NextResponse.json(
      { error: '누가 쓰는지 먼저 골라 주세요.' },
      { status: 409 },
    );
  }

  // family_id 조건을 함께 걸어 남의 집 아이를 못 건드리게 합니다.
  const { error } = await supabase
    .from('children')
    .update(row)
    .eq('id', childId)
    .eq('family_id', user.id);

  if (error) {
    console.error('[settings] 자녀 설정 저장 실패', error);
    return NextResponse.json(
      { error: '설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
