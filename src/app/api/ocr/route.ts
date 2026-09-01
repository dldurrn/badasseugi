import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api';
import { limitsFor, planOf } from '@/lib/plan';
import { toDateKeyInSeoul } from '@/lib/review';

/**
 * 문제지 사진에서 받아쓰기 문장을 추출합니다.
 *
 * 보안: Anthropic API 키는 이 서버 라우트에서만 읽습니다.
 * 절대 클라이언트로 내려보내지 않습니다.
 *
 * 비용: 호출마다 과금되므로 가족당 하루 호출 수를 제한합니다.
 */

/**
 * Vercel은 요청 본문이 4.5MB를 넘으면 이 함수에 닿기도 전에 413으로 막습니다.
 * 인프라 제한이라 코드로 못 늘립니다. 그 아래로 잡아야 우리 안내 문구를 띄울 수 있습니다.
 * 화면에서 미리 1600px JPEG로 줄여 보내므로 보통 1MB를 넘지 않습니다.
 */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * Anthropic이 받는 형식만 둡니다. HEIC는 거부합니다 —
 * 넣어 두면 아이폰 사진이 통과했다가 Anthropic 단계에서 실패해
 * "밝은 곳에서 다시 찍으라"는 엉뚱한 안내를 보게 됩니다.
 */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const EXTRACTION_PROMPT = `이 사진은 한국 초등학교 받아쓰기 문제지입니다. 사진 속 받아쓰기 문장들을 순서대로 추출해 주세요.

규칙:
1. 문제 번호나 괄호는 빼고 문장만 추출합니다.
2. 마침표, 물음표, 느낌표, 쉼표는 사진에 있는 그대로 유지합니다.
3. 띄어쓰기도 사진에 보이는 그대로 유지합니다.
4. 글자가 전혀 읽히지 않는 문장은 제외합니다.

받침은 작아서 잘못 읽기 쉽습니다. 특히 ㄴ/ㄷ, ㄹ/ㄼ, ㅅ/ㅆ, ㅈ/ㅊ 을 주의해서 보세요.
읽은 결과가 실제 한국어 낱말인지 확인하세요.
한글 자모의 이름은 다음 열넷뿐입니다:
기역 니은 디귿 리을 미음 비읍 시옷 이응 지읒 치읓 키읔 티읕 피읖 히읗

고칠 것이 있으면 **sentences 에는 고친 뒤의 글자를 넣으세요.**
그리고 corrections 에 from(사진에서 읽은 원래 글자)과 to(고친 글자)를 함께 남기세요.
to 는 sentences 의 그 자리에 들어간 값과 정확히 같아야 합니다.
확신이 서지 않아 고치지 않았다면 sentences 는 그대로 두고 uncertain 에만 남기세요.
**사진에 없는 내용을 지어내지 마세요.** 고친 것은 전부 corrections 에 드러나야 합니다.

다른 설명이나 마크다운 없이 오직 아래 형태의 JSON 객체로만 답하세요.
{
  "sentences": ["아기","우리","ㄷ, 디귿"],
  "corrections": [{ "index": 2, "from": "ㄷ, 디근", "to": "ㄷ, 디귿", "why": "자모 이름은 '디귿'입니다" }],
  "uncertain": [{ "index": 0, "why": "글자가 흐려서 확실하지 않습니다" }]
}
위 예에서 sentences 의 2번 자리가 "ㄷ, 디근"이 아니라 고친 값 "ㄷ, 디귿"인 것에 주의하세요.
index 는 sentences 배열에서의 자리(0부터)입니다.
고친 것이 없으면 corrections 는 [] 로, 미심쩍은 것이 없으면 uncertain 은 [] 로 두세요.
문장을 하나도 찾지 못하면 sentences 를 [] 로 두세요.`;

/** AI가 고쳐 적은 곳. 부모가 되돌릴 수 있도록 원래 읽은 값도 함께 보냅니다. */
export interface OcrCorrection {
  index: number;
  from: string;
  to: string;
  why: string;
}

/** AI가 확신하지 못한 곳. 고치지는 않았지만 부모가 봐야 합니다. */
export interface OcrUncertain {
  index: number;
  why: string;
}

/** 짧게 자르고 자리 번호가 실제 문장 범위 안인지 확인합니다. */
function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function readCorrections(raw: unknown, count: number): OcrCorrection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const c = item as Record<string, unknown>;
      return {
        index: Number(c?.index),
        from: clip(c?.from, 200),
        to: clip(c?.to, 200),
        why: clip(c?.why, 120),
      };
    })
    .filter(
      (c) =>
        Number.isInteger(c.index) &&
        c.index >= 0 &&
        c.index < count &&
        c.to.length > 0 &&
        // 바뀐 게 없으면 알릴 것도 없습니다.
        c.from !== c.to,
    )
    .slice(0, 30);
}

function readUncertain(raw: unknown, count: number): OcrUncertain[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const u = item as Record<string, unknown>;
      return { index: Number(u?.index), why: clip(u?.why, 120) };
    })
    .filter((u) => Number.isInteger(u.index) && u.index >= 0 && u.index < count)
    .slice(0, 30);
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: '사진 인식이 아직 설정되지 않았어요. 직접 입력으로 문제를 넣어 주세요.' },
      { status: 503 },
    );
  }

  // 로그인 확인 — 가족 단위로 사용량을 세기 위해 필요합니다.
  // 다른 라우트와 같은 함수를 씁니다. 여기만 손으로 다시 쓰면
  // 나중에 인증 규칙이 바뀔 때 이 파일 하나가 조용히 뒤처집니다.
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  /*
    사진으로 문제 넣기는 유료 기능이 될 자리입니다(lib/plan.ts).
    지금은 `PLAN_ENABLED` 가 꺼져 있어 아무도 막히지 않습니다 —
    돈을 낼 길이 없는데 막으면 안 되니까요.
    켜는 순간 여기서 걸립니다. 화면 여기저기에 조건문을 뿌리지 않으려고
    막는 자리를 미리 정해 둡니다.
  */
  if (!limitsFor(planOf(null)).photoInput) {
    return NextResponse.json(
      { error: '사진으로 문제 넣기는 유료에서 쓸 수 있어요. 직접 입력으로도 넣을 수 있어요.' },
      { status: 402 },
    );
  }

  // 일일 사용량 확인
  const limit = Number(process.env.OCR_DAILY_LIMIT ?? 30);
  // 한국 날짜로 셉니다. UTC 로 두면 하루가 아침 9시에 바뀝니다.
  const today = toDateKeyInSeoul();
  const { data: usage } = await supabase
    .from('ocr_usage')
    .select('count')
    .eq('family_id', user.id)
    .eq('used_on', today)
    .maybeSingle();

  if ((usage?.count ?? 0) >= limit) {
    return NextResponse.json(
      { error: '오늘은 사진 인식을 충분히 사용했어요. 내일 다시 시도하거나 직접 입력해 주세요.' },
      { status: 429 },
    );
  }

  // 이미지 확인
  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get('image');
    if (value instanceof File) file = value;
  } catch {
    return NextResponse.json({ error: '사진을 읽지 못했어요.' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: '사진이 없어요.' }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: '사진 용량이 너무 커요. 조금 더 작게 찍거나 직접 입력해 주세요.' },
      { status: 400 },
    );
  }

  // 형식을 알 수 없으면 짐작하지 않고 막습니다.
  // 예전에는 모르면 jpeg로 우겼는데, 실제 내용이 png면 Anthropic이
  // "jpeg라더니 png로 보인다"며 거부해 원인을 알 수 없는 실패가 났습니다.
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: '이 사진 형식은 읽을 수 없어요. 사진을 다시 찍거나 직접 입력해 주세요.' },
      { status: 400 },
    );
  }
  const mediaType = file.type;

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');

  // Anthropic 호출
  let sentences: string[];
  let corrections: OcrCorrection[] = [];
  let uncertain: OcrUncertain[] = [];
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic ${response.status}`);
    }

    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (payload.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n')
      .replace(/```json|```/g, '')
      .trim();

    const parsed: unknown = JSON.parse(text);

    // 예전에는 문자열 배열만 받았습니다. 모델이 옛 형태로 답해도 깨지지 않게 둘 다 받습니다.
    const rawSentences = Array.isArray(parsed)
      ? parsed
      : ((parsed as { sentences?: unknown })?.sentences ?? null);
    if (!Array.isArray(rawSentences)) throw new Error('예상과 다른 형식');

    sentences = rawSentences
      .map((s) => String(s).replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 0 && s.length <= 200);

    if (!Array.isArray(parsed)) {
      const obj = parsed as { corrections?: unknown; uncertain?: unknown };
      corrections = readCorrections(obj.corrections, sentences.length);
      uncertain = readUncertain(obj.uncertain, sentences.length);
    }
  } catch (error) {
    console.error('[ocr] 인식 실패', error);
    return NextResponse.json(
      { error: '사진에서 문장을 읽지 못했어요. 밝은 곳에서 똑바로 다시 찍거나 직접 입력해 주세요.' },
      { status: 502 },
    );
  }

  // 사용량 기록 (실패해도 응답은 정상 반환)
  await supabase
    .from('ocr_usage')
    .upsert(
      { family_id: user.id, used_on: today, count: (usage?.count ?? 0) + 1 },
      { onConflict: 'family_id,used_on' },
    );

  return NextResponse.json({ sentences, corrections, uncertain });
}
