import { NextResponse } from 'next/server';
import { readJson, requireUser } from '@/lib/api';
import { verifyPin } from '@/lib/pin';
import { setProfileCookies } from '@/lib/profile-server';

/**
 * 자녀 프로필로 들어가기.
 *
 * PIN 비교는 반드시 서버에서 합니다.
 * 화면으로 해시를 내려보내면 잠금을 건 의미가 없어집니다.
 */

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await params;

  const body = await readJson<{ pin?: unknown }>(request);

  const { data: child } = await supabase
    .from('children')
    .select('id, pin_hash')
    .eq('id', id)
    .maybeSingle();

  if (!child) {
    return NextResponse.json({ error: '프로필을 찾지 못했어요.' }, { status: 404 });
  }

  if (child.pin_hash) {
    const pin = typeof body?.pin === 'string' ? body.pin : '';
    const matched = await verifyPin(pin, child.pin_hash);
    if (!matched) {
      // 어느 자리가 틀렸는지는 알려주지 않습니다.
      return NextResponse.json(
        { error: '비밀번호가 달라요. 다시 눌러 볼까요?' },
        { status: 403 },
      );
    }
  }

  await setProfileCookies({ view: 'child', childId: child.id });
  return NextResponse.json({ ok: true });
}
