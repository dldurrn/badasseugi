import { NextResponse } from 'next/server';
import { badRequest, readJson, requireUser } from '@/lib/api';
import { readReview } from '@/lib/scan';
import { MAX_BULK_SETS, normalizeSentences, normalizeSetName } from '@/lib/sets';

/** 받아쓰기 세트 만들기. 문장은 부모가 넣는 원문이라 정답 그 자체입니다. */

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const body = await readJson<{ name?: unknown; sentences?: unknown; sets?: unknown }>(request);
  if (!body) return badRequest('입력을 읽지 못했어요.');

  /*
    급수표 한 장에서 여러 세트를 한꺼번에 만들 때.

    **확인 전(needs_review)으로 만듭니다.** 아이 목록에 안 뜨고, 보호자 홈이 급 순서대로
    하나씩 확인해 달라고 합니다. 한 번에 다 확인하라고 하면 훑고 넘어가기 때문입니다.
  */
  if (Array.isArray(body.sets)) {
    const rows = body.sets.slice(0, MAX_BULK_SETS).flatMap((raw) => {
      const item = (raw ?? {}) as { name?: unknown; sentences?: unknown; review?: unknown };
      const name = normalizeSetName(item.name);
      const sentences = normalizeSentences(item.sentences);
      if (!name || sentences.length === 0) return [];
      return [{ id: crypto.randomUUID(), name, sentences, review: readReview(item.review, sentences.length) }];
    });
    if (rows.length === 0) return badRequest('만들 세트가 없어요.');

    // id 를 여기서 정합니다. 여러 줄을 넣고 돌려받는 순서에 기대지 않으려고요.
    const { error } = await supabase.from('sets').insert(
      rows.map((r) => ({
        id: r.id,
        family_id: user.id,
        name: r.name,
        needs_review: true,
        review_notes: r.review,
      })),
    );
    if (error) {
      console.error('[sets] 한꺼번에 만들기 실패', error);
      return NextResponse.json({ error: '세트를 만들지 못했어요.' }, { status: 500 });
    }

    const { error: itemError } = await supabase.from('set_items').insert(
      rows.flatMap((r) =>
        r.sentences.map((sentence, index) => ({ set_id: r.id, sentence, order_index: index })),
      ),
    );
    if (itemError) {
      console.error('[sets] 한꺼번에 문장 저장 실패', itemError);
      await supabase.from('sets').delete().in('id', rows.map((r) => r.id));
      return NextResponse.json({ error: '문장을 저장하지 못했어요.' }, { status: 500 });
    }

    return NextResponse.json({ ids: rows.map((r) => r.id) });
  }

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
