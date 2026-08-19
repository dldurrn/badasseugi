import { NextResponse } from 'next/server';
import { badRequest, readJson, requireUser } from '@/lib/api';
import { normalizeSentences, normalizeSetName } from '@/lib/sets';

/** 받아쓰기 세트 만들기. 문장은 부모가 넣는 원문이라 정답 그 자체입니다. */

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const body = await readJson<{ name?: unknown; sentences?: unknown }>(request);
  if (!body) return badRequest('입력을 읽지 못했어요.');

  const name = normalizeSetName(body.name);
  if (!name) return badRequest('세트 이름을 1~60자로 적어 주세요.');

  const sentences = normalizeSentences(body.sentences);
  if (sentences.length === 0) return badRequest('문장을 한 개 이상 넣어 주세요.');

  const { data: set, error } = await supabase
    .from('sets')
    .insert({ family_id: user.id, name })
    .select('id')
    .single();

  if (error || !set) {
    console.error('[sets] 생성 실패', error);
    return NextResponse.json({ error: '세트를 만들지 못했어요.' }, { status: 500 });
  }

  const { error: itemError } = await supabase.from('set_items').insert(
    sentences.map((sentence, index) => ({
      set_id: set.id,
      sentence,
      order_index: index,
    })),
  );

  if (itemError) {
    // 문장이 없는 빈 세트가 남으면 아이가 눌렀을 때 풀 게 없습니다. 되돌립니다.
    console.error('[sets] 문장 저장 실패', itemError);
    await supabase.from('sets').delete().eq('id', set.id);
    return NextResponse.json({ error: '문장을 저장하지 못했어요.' }, { status: 500 });
  }

  return NextResponse.json({ id: set.id });
}
