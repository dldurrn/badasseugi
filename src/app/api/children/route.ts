import { NextResponse } from 'next/server';
import { badRequest, normalizeNickname, readJson, requireUser } from '@/lib/api';
import { DEFAULT_AVATAR, isAllowedAvatar } from '@/lib/avatars';
import { limitsFor, planOf } from '@/lib/plan';
import { MAX_CHILDREN } from '@/lib/profile';
import { hashPin, isValidPin } from '@/lib/pin';

/**
 * 자녀 프로필 만들기.
 *
 * PIN 해시는 서버에서만 만듭니다(지침 8과 같은 이유).
 * 별명만 받고 실명·생일 같은 정보는 애초에 필드를 두지 않습니다.
 */

interface CreateBody {
  nickname?: unknown;
  avatar?: unknown;
  pin?: unknown;
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const body = await readJson<CreateBody>(request);
  if (!body) return badRequest('입력을 읽지 못했어요.');

  const nickname = normalizeNickname(body.nickname);
  if (!nickname) return badRequest('별명을 1~20자로 적어 주세요.');

  const avatar = isAllowedAvatar(body.avatar) ? body.avatar : DEFAULT_AVATAR;

  let pinHash: string | null = null;
  if (body.pin !== undefined && body.pin !== null && body.pin !== '') {
    if (typeof body.pin !== 'string' || !isValidPin(body.pin)) {
      return badRequest('비밀번호는 숫자 4자리로 정해 주세요.');
    }
    pinHash = await hashPin(body.pin);
  }

  const { count } = await supabase
    .from('children')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', user.id);

  /*
    상한이 둘입니다.

    `MAX_CHILDREN` 은 「실수로 늘어나는 것」을 막는 벽이고,
    요금제 한도는 「돈을 낸 만큼」을 나누는 선입니다. 뜻이 다르니 둘 다 둡니다.
    지금은 요금제가 꺼져 있어(lib/plan.ts) 실질적으로 MAX_CHILDREN 만 걸립니다.
  */
  const 한도 = Math.min(MAX_CHILDREN, limitsFor(planOf(null)).children);
  if ((count ?? 0) >= 한도) {
    return badRequest(
      한도 < MAX_CHILDREN
        ? `무료로는 프로필을 ${한도}개까지 만들 수 있어요.`
        : `프로필은 ${한도}개까지 만들 수 있어요.`,
    );
  }

  const { data, error } = await supabase
    .from('children')
    .insert({ family_id: user.id, nickname, avatar, pin_hash: pinHash })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[children] 생성 실패', error);
    return NextResponse.json(
      { error: '프로필을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}
