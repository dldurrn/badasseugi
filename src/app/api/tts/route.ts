import { NextResponse } from 'next/server';
import { DEFAULT_VOICE } from '@/lib/tts';
import { badRequest, readJson, requireUser } from '@/lib/api';

/**
 * 문장을 소리로 바꿔 돌려줍니다. (Google Cloud Text-to-Speech)
 *
 * 보안: API 키는 이 서버 라우트에서만 읽습니다(절대 원칙 8).
 * 클라이언트는 `/api/tts`만 부르고 키는 구경도 하지 못합니다.
 *
 * 클로바 대신 Google을 쓰는 이유
 * - 클로바는 쓰든 안 쓰든 월 고정비가 나갑니다. 우리 사용량으로는 그 돈의 1%도 못 씁니다.
 * - OpenAI는 목소리가 영어에 맞춰져 있어(공식 문서 "optimized for English")
 *   받아쓰기에 쓰면 아이가 틀린 발음을 정답으로 배우게 됩니다.
 * - Google은 ko-KR 전용 목소리가 있고, 종량제라 안 쓰면 안 나갑니다.
 *
 * 키가 없으면 503을 돌려줍니다. 화면은 그때 브라우저 내장 음성으로 넘어갑니다.
 */

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/** 받아쓰기 문장 상한과 같게 둡니다. 이보다 긴 요청은 우리 화면에서 나올 수 없습니다. */
const MAX_TEXT = 200;

/** 기본 목소리. 설정에서 고르면 그 값이 넘어옵니다. */


interface Body {
  text?: unknown;
  rate?: unknown;
  voice?: unknown;
  /** 어절 사이에 둘 쉼(ms). 0이면 이어서 읽습니다. */
  gapMs?: unknown;
}

/**
 * SSML 안에서 뜻을 갖는 글자를 막습니다.
 *
 * 특히 큰따옴표가 문제입니다. 12단계 문장이 전부 `"안녕!" 하고 인사했어요.` 꼴이라
 * 그대로 넣으면 SSML이 깨지고 그 문장만 소리가 안 납니다.
 */
function escapeSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 어절마다 쉬어 읽는 문장을 SSML로 만듭니다.
 *
 * 예전에는 낱말을 하나씩 따로 합성해 이어 붙였습니다.
 * 그러면 TTS가 낱말 하나를 **완결된 문장으로** 읽습니다 —
 * 「콧잔등에」를 마침표 찍듯 뚝 떨어뜨리고 다음 낱말도 그렇게 읽으니,
 * 또박또박 들으려고 누른 것이 오히려 더 안 들렸습니다.
 *
 * 한 번에 보내면 문장 억양이 살아 있는 채로 사이만 벌어집니다.
 * 요청도 어절 수만큼이 아니라 한 번이면 끝납니다.
 */
function buildChunkedSsml(text: string, gapMs: number): string {
  const gap = `<break time="${Math.round(gapMs)}ms"/>`;
  const body = text
    .split(' ')
    .filter(Boolean)
    .map(escapeSsml)
    .join(gap);
  return `<speak>${body}</speak>`;
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
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
  // Google의 speakingRate는 우리와 방향이 같아 그대로 넘기면 됩니다(클로바는 반대였습니다).
  const rawRate = typeof body.rate === 'number' ? body.rate : 1;
  const rate = Math.min(4, Math.max(0.25, rawRate));

  const voice =
    typeof body.voice === 'string' && /^ko-KR-[\w-]{1,40}$/.test(body.voice)
      ? body.voice
      : DEFAULT_VOICE;

  // 0이면 이어서 읽고, 값이 있으면 어절 사이를 그만큼 벌립니다.
  const rawGap = typeof body.gapMs === 'number' ? body.gapMs : 0;
  const gapMs = Math.min(2000, Math.max(0, rawGap));
  const ssml = gapMs > 0 ? buildChunkedSsml(text, gapMs) : null;

  // 과금은 Google이 실제로 받는 글자 수 기준입니다. SSML은 태그까지 셉니다.
  const billedChars = ssml ? ssml.length : text.length;

  /* 하루 사용량 확인 — 과금 단위가 글자 수라 글자 수로 셉니다 -------------- */
  const limit = Number(process.env.TTS_DAILY_LIMIT ?? 20000);
  const today = new Date().toISOString().slice(0, 10);

  const { data: usage } = await supabase
    .from('tts_usage')
    .select('chars')
    .eq('family_id', user.id)
    .eq('used_on', today)
    .maybeSingle();

  const usedToday = (usage?.chars as number | undefined) ?? 0;
  if (usedToday >= limit) {
    // 막지 않고 브라우저 음성으로 넘깁니다. 아이 화면에서 소리가 아예 안 나는 것보다 낫습니다.
    return NextResponse.json({ error: 'tts-daily-limit' }, { status: 429 });
  }

  /* 합성 ------------------------------------------------------------------ */
  let audioBase64: string;
  try {
    const response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: ssml ? { ssml } : { text },
        voice: { languageCode: 'ko-KR', name: voice },
        audioConfig: { audioEncoding: 'MP3', speakingRate: rate },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[tts] Google 응답 실패', response.status, detail.slice(0, 300));
      return NextResponse.json({ error: 'tts-failed' }, { status: 502 });
    }

    const payload = (await response.json()) as { audioContent?: string };
    if (!payload.audioContent) throw new Error('audioContent 없음');
    audioBase64 = payload.audioContent;
  } catch (error) {
    console.error('[tts] 합성 실패', error);
    return NextResponse.json({ error: 'tts-failed' }, { status: 502 });
  }

  // 사용량 기록 (실패해도 소리는 돌려줍니다)
  await supabase
    .from('tts_usage')
    .upsert(
      { family_id: user.id, used_on: today, chars: usedToday + billedChars },
      { onConflict: 'family_id,used_on' },
    );

  const audio = Buffer.from(audioBase64, 'base64');
  return new NextResponse(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audio.length),
      // 같은 문장을 여러 번 듣는 앱이라 브라우저에도 남겨 둡니다.
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
