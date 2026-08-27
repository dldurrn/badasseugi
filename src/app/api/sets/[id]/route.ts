import { NextResponse } from 'next/server';
import { badRequest, readJson, requireUser } from '@/lib/api';
import { normalizeSentences, normalizeSetName } from '@/lib/sets';

/**
 * 받아쓰기 세트 고치기·지우기.
 *
 * 문장은 부분 수정 대신 통째로 갈아 끼웁니다.
 * 순서 바꾸기·삭제·추가가 한 화면에서 일어나기 때문에
 * 무엇이 어떻게 바뀌었는지 따지는 것보다 이 편이 어긋날 여지가 적습니다.
 */

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await params;

  const body = await readJson<{ name?: unknown; sentences?: unknown }>(request);
  if (!body) return badRequest('입력을 읽지 못했어요.');

  const name = normalizeSetName(body.name);
  if (!name) return badRequest('세트 이름을 1~60자로 적어 주세요.');

  const sentences = normalizeSentences(body.sentences);
  if (sentences.length === 0) return badRequest('문장을 한 개 이상 넣어 주세요.');

  const { data: set, error } = await supabase
    .from('sets')
    .update({ name })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[sets] 수정 실패', error);
    return NextResponse.json({ error: '고치지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
  if (!set) return NextResponse.json({ error: '세트를 찾지 못했어요.' }, { status: 404 });

  await supabase.from('set_items').delete().eq('set_id', id);
  const { error: itemError } = await supabase.from('set_items').insert(
    sentences.map((sentence, index) => ({ set_id: id, sentence, order_index: index })),
  );

  if (itemError) {
    console.error('[sets] 문장 저장 실패', itemError);
    return NextResponse.json(
      { error: '문장을 저장하지 못했어요. 다시 한 번 저장해 주세요.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await params;

  // 이미 푼 기록(attempts)은 남습니다. 스키마에서 set_id를 null로 두게 해 두었습니다.
  const { data, error } = await supabase
    .from('sets')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[sets] 삭제 실패', error);
    return NextResponse.json({ error: '지우지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: '세트를 찾지 못했어요.' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
