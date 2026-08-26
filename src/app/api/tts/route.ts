import { NextResponse } from 'next/server';
import { badRequest, readJson, requireUser } from '@/lib/api';
import { pickEngine } from '@/lib/tts-engines';

/**
 * 문장을 소리로 바꿔 돌려줍니다.
 *
 * 보안: API 키는 이 서버 라우트에서만 읽습니다(절대 원칙 8).
 * 클라이언트는 `/api/tts`만 부르고 키는 구경도 하지 못합니다.
 *
 * 어느 회사를 쓸지는 `lib/tts-engines.ts`가 환경 변수를 보고 정합니다.
 * 이 파일은 회사가 무엇인지 몰라도 됩니다 — 로그인 확인, 하루 한도, 응답만 맡습니다.
 *
 * 키가 하나도 없으면 503을 돌려줍니다. 화면은 그때 브라우저 내장 음성으로 넘어갑니다.
 */

/** 받아쓰기 문장 상한과 같게 둡니다. 이보다 긴 요청은 우리 화면에서 나올 수 없습니다. */
const MAX_TEXT = 200;

interface Body {
  text?: unknown;
  rate?: unknown;
  voice?: unknown;
  /** 어절 사이에 둘 쉼(ms). 0이면 이어서 읽습니다. */
  gapMs?: unknown;
}

export async function POST(request: Request) {
  const engine = pickEngine();
  if (!engine) {
    // 화면이 조용히 브라우저 음성으로 넘어가도록 이유를 담아 보냅니다.
    return NextResponse.json({ error: 'tts-not-configured' }, { status: 503 });
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const body = await readJson<Body>(request);
  if (!body) return badRequest('요청을 읽지 못했어요.');

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return badRequest('읽을 문장이 없어요.');
  if (text.length > MAX_TEXT) return badRequest('문장이 너무 길어요.');

  // 우리 화면이 쓰는 값은 0.65 / 0.85 / 1.0 입니다.
  const rawRate = typeof body.rate === 'number' ? body.rate : 1;
  const rate = Math.min(2, Math.max(0.5, rawRate));

  // 다른 회사의 목소리 이름이 남아 있을 수 있어(공급자를 바꾸면 그렇습니다)
  // 형태가 맞지 않으면 조용히 기본값으로 돌아갑니다.
  const voice =
    typeof body.voice === 'string' && engine.voicePattern.test(body.voice)
      ? body.voice
      : engine.defaultVoice;

  const rawGap = typeof body.gapMs === 'number' ? body.gapMs : 0;
  const gapMs = Math.min(2000, Math.max(0, rawGap));

  /* 하루 사용량 확인 — 과금 단위가 글자 수라 글자 수로 셉니다 -------------- */
  const today = new Date().toISOString().slice(0, 10);

  const { data: usage } = await supabase
    .from('tts_usage')
    .select('chars')
    .eq('family_id', user.id)
    .eq('used_on', today)
    .maybeSingle();

  const usedToday = (usage?.chars as number | undefined) ?? 0;
  if (usedToday >= engine.dailyLimit) {
    // 막지 않고 브라우저 음성으로 넘깁니다. 아이 화면에서 소리가 아예 안 나는 것보다 낫습니다.
    return NextResponse.json({ error: 'tts-daily-limit' }, { status: 429 });
  }

  /* 합성 ------------------------------------------------------------------ */
  let result;
  try {
    result = await engine.synthesize({ text, rate, voice, gapMs });
  } catch (error) {
    console.error(`[tts] ${engine.name} 합성 실패`, error);
    return NextResponse.json({ error: 'tts-failed' }, { status: 502 });
  }

  // 사용량 기록 (실패해도 소리는 돌려줍니다)
  await supabase
    .from('tts_usage')
    .upsert(
      { family_id: user.id, used_on: today, chars: usedToday + result.billedChars },
      { onConflict: 'family_id,used_on' },
    );

  return new NextResponse(result.audio, {
    headers: {
      'Content-Type': result.contentType,
      'Content-Length': String(result.audio.byteLength),
      // 같은 문장을 여러 번 듣는 앱이라 브라우저에도 남겨 둡니다.
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
