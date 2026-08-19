import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api';

/**
 * 오답노트 항목 지우기 (보호자 화면).
 *
 * 부모가 세트의 문장을 고치면, 옛 문장으로 쌓인 오답노트가 남습니다.
 * 오답노트는 문장 원문으로 연결되어 있어서 옛 문장과 새 문장을 이어 줄 방법이 없습니다.
 * 남은 항목도 아이가 실제로 틀렸던 문장이라 연습 자체는 유효하지만,
 * 오타였던 경우처럼 더는 필요 없는 항목을 치울 길은 있어야 합니다.
 */

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await params;

  // 남의 가족 노트면 RLS(owns_child)에 걸려 아무것도 지워지지 않습니다.
  const { data, error } = await supabase
    .from('wrong_notes')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[notes] 삭제 실패', error);
    return NextResponse.json({ error: '지우지 못했어요.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: '항목을 찾지 못했어요.' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
