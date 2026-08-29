import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api';
import { listWrongNotes } from '@/lib/data';
import { readActiveChild } from '@/lib/profile-server';
import { activeNotes } from '@/lib/review';
import { fillTwins } from '@/lib/twin-server';

/**
 * 짝이 없는 오답노트를 채웁니다 — **놓친 것 줍기**.
 *
 * 짝은 원래 오답이 생기는 순간(`/api/sessions`)에 미리 만들어 둡니다.
 * 아이가 원본을 맞힌 그 자리에서 만들면 2~5초를 기다리게 되니까요.
 *
 * 그래도 짝이 없는 노트가 남습니다 —
 * 이 기능이 붙기 전에 생긴 노트, 만들다 실패한 노트, 짝을 다 쓴 노트.
 * 오답노트 화면이 열릴 때 이 라우트가 그것들을 줍습니다.
 *
 * 어느 아이인지는 **쿠키로 정합니다.** 화면이 보낸 id 를 믿으면
 * 남의 집 아이 노트를 건드리라고 보낼 수 있습니다(설정 저장과 같은 이유).
 */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const child = await readActiveChild();
  if (!child) {
    // 아직 누가 쓰는지 안 골랐습니다. 화면에서는 일어날 수 없지만 조용히 넘깁니다.
    return NextResponse.json({ filled: 0, tried: 0 });
  }

  const notes = activeNotes(await listWrongNotes(child.id));

  /*
    실패해도 화면은 그대로 굴러가야 합니다.
    짝이 없으면 예전처럼 원본을 두 번 풀어 졸업합니다 — 아이는 아무것도 못 느낍니다.
  */
  try {
    const result = await fillTwins(supabase, child.id, notes);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[twin] 채우기 실패', error);
    return NextResponse.json({ filled: 0, tried: 0 });
  }
}
