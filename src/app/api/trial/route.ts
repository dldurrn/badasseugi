import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isTrialEvent } from '@/lib/trial';

/**
 * 로그인 전 체험의 횟수 세기(`0014_trial_counts`).
 *
 * 로그인을 확인하지 않습니다 — 셀 대상이 바로 로그인 안 한 사람입니다.
 * 몸통에서 받는 것은 갈래 이름 하나뿐이고, DB 함수가 한 번 더 거릅니다.
 *
 * **언제나 ok 로 답합니다.** 세다가 실패했다고 체험하는 사람 화면이 흔들리면 안 됩니다.
 * 마이그레이션 전이면 함수가 없어 실패하는데, 그때도 조용히 넘어갑니다.
 */
export async function POST(request: Request) {
  let event: unknown;
  try {
    event = ((await request.json()) as { event?: unknown }).event;
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!isTrialEvent(event)) return NextResponse.json({ ok: true });

  const supabase = await createClient();
  const { error } = await supabase.rpc('bump_trial', { p_event: event });
  if (error) console.error('[trial] 세기 실패', error.message);
  return NextResponse.json({ ok: true });
}
