import { NextResponse } from 'next/server';
import { badRequest, readJson, requireUser } from '@/lib/api';
import {
  looksBlocked,
  matchVoice,
  markBlocked,
  pickEngines,
  type Engine,
} from '@/lib/tts-engines';

/**
 * 문장을 소리로 바꿔 돌려줍니다.
 *
 * 보안: API 키는 이 서버 라우트에서만 읽습니다(절대 원칙 8).
 * 클라이언트는 `/api/tts`만 부르고 키는 구경도 하지 못합니다.
 *
 * 어느 회사를 쓸지는 `lib/tts-engines.ts`가 환경 변수를 보고 정합니다.
 * 이 파일은 회사가 무엇인지 몰라도 됩니다 — 로그인 확인, 하루 한도, 응답만 맡습니다.
 *
 * **한 회사가 막히면 다음 회사로 넘어갑니다.** 아이 화면에서 소리가 나는 것이
 * 어느 회사 소리냐보다 중요합니다. 둘 다 안 되면 그때 브라우저 내장 음성입니다.
 *
 * 키가 하나도 없으면 503을 돌려줍니다. 화면은 그때 브라우저 내장 음성으로 넘어갑니다.
 */

/** 받아쓰기 문장 상한과 같게 둡니다. 이보다 긴 요청은 우리 화면에서 나올 수 없습니다. */
const MAX_TEXT = 200;

/** 코드마다 사람이 읽을 문구. 화면에 그대로 띄워도 말이 되게 둡니다. */
const TTS_MESSAGE = {
  'daily-limit': '오늘 읽어 줄 수 있는 만큼을 다 썼어요. 내일 다시 들을 수 있어요.',
  blocked: '음성 서비스가 사용을 막았어요. 기다린다고 풀리지는 않아요.',
  failed: '소리를 만들지 못했어요. 잠시 후 다시 눌러 주세요.',
} as const;

interface Body {
  text?: unknown;
  rate?: unknown;
  voice?: unknown;
  /** 어절 사이에 둘 쉼(ms). 0이면 이어서 읽습니다. */
  gapMs?: unknown;
}

export async function POST(request: Request) {
  const engines = pickEngines();
  if (engines.length === 0) {
    // 화면이 조용히 브라우저 음성으로 넘어가도록 이유를 담아 보냅니다.
    return NextResponse.json(
      { error: 'tts-not-configured', message: '음성 서비스가 연결되지 않았어요.' },
      { status: 503 },
    );
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

  /* 합성 — 안 되면 다음 회사로 -------------------------------------------
     아이 화면에서 **소리가 나는 것**이 어느 회사냐보다 중요합니다.
     한 회사가 막혀도 다른 키가 살아 있으면 그쪽으로 읽어 줍니다.
     예전에는 회사 하나만 고르고 끝이라, 타입캐스트가 막히자
     Google 키가 멀쩡한데도 브라우저 내장 음성으로 떨어졌습니다.        */
  let result: Awaited<ReturnType<Engine['synthesize']>> | null = null;
  let served: Engine | null = null;
  /* 마지막으로 무엇 때문에 못 했는지. 화면은 이걸 보고 부모에게 알립니다. */
  let reason: 'daily-limit' | 'blocked' | 'failed' = 'failed';

  for (const engine of engines) {
    if (usedToday >= engine.dailyLimit) {
      reason = 'daily-limit';
      continue;
    }

    // 다른 회사의 목소리 이름이 남아 있을 수 있습니다(공급자가 바뀌면 그렇습니다).
    // 남녀는 지켜서 옮기고, 못 알아보면 그때 기본 목소리로 갑니다.
    const voice = matchVoice(engine, body.voice);

    try {
      result = await engine.synthesize({ text, rate, voice, gapMs });
      served = engine;
      break;
    } catch (error) {
      console.error(`[tts] ${engine.name} 합성 실패`, error);
      if (looksBlocked(error)) {
        // 막힌 회사는 한동안 건너뜁니다. 문장마다 헛걸음하면 아이가 그만큼 기다립니다.
        markBlocked(engine.name);
        reason = 'blocked';
      } else {
        reason = 'failed';
      }
    }
  }

  if (!result || !served) {
    const status = reason === 'daily-limit' ? 429 : reason === 'blocked' ? 403 : 502;
    /*
      코드와 한국어 문구를 함께 보냅니다.

      화면은 `error` 코드를 보고 갈래를 정합니다 — 잠깐 끊긴 것인지,
      오늘 몫을 다 쓴 것인지, 아예 막힌 것인지에 따라 할 일이 다릅니다.
      다만 코드만 보내면 이 라우트만 다른 라우트와 말이 다릅니다.
      다른 곳은 모두 화면에 그대로 띄울 수 있는 한국어를 돌려줍니다.
      나중에 누가 이 응답을 그냥 보여 줘도 「tts-blocked」가 뜨지 않도록 둘 다 담습니다.
    */
    return NextResponse.json({ error: `tts-${reason}`, message: TTS_MESSAGE[reason] }, { status });
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
