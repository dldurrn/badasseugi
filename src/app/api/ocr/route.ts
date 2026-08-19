import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 문제지 사진에서 받아쓰기 문장을 추출합니다.
 *
 * 보안: Anthropic API 키는 이 서버 라우트에서만 읽습니다.
 * 절대 클라이언트로 내려보내지 않습니다.
 *
 * 비용: 호출마다 과금되므로 가족당 하루 호출 수를 제한합니다.
 */

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const EXTRACTION_PROMPT = `이 사진은 한국 초등학교 받아쓰기 문제지입니다. 사진 속 받아쓰기 문장들을 순서대로 추출해 주세요.

규칙:
1. 문제 번호나 괄호는 빼고 문장만 추출합니다.
2. 마침표, 물음표, 느낌표, 쉼표는 사진에 있는 그대로 유지합니다.
3. 띄어쓰기도 사진에 보이는 그대로 유지합니다.
4. 확실히 읽히지 않는 글자가 있으면 그 문장은 제외합니다.

다른 설명이나 마크다운 없이 오직 JSON 문자열 배열로만 답하세요.
예: ["오늘은 날씨가 맑습니다.","친구와 함께 놀았어요."]
문장을 하나도 찾지 못하면 [] 로 답하세요.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: '사진 인식이 아직 설정되지 않았어요. 직접 입력으로 문제를 넣어 주세요.' },
      { status: 503 },
    );
  }

  // 로그인 확인 — 가족 단위로 사용량을 세기 위해 필요합니다.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }

  // 일일 사용량 확인
  const limit = Number(process.env.OCR_DAILY_LIMIT ?? 30);
  const today = new Date().toISOString().slice(0, 10);
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
      { error: '사진 용량이 너무 커요. 6MB 이하로 다시 찍어 주세요.' },
      { status: 400 },
    );
  }
  const mediaType = ALLOWED_TYPES.includes(file.type) ? file.type : 'image/jpeg';

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');

  // Anthropic 호출
  let sentences: string[];
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
    if (!Array.isArray(parsed)) throw new Error('예상과 다른 형식');

    sentences = parsed
      .map((s) => String(s).replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 0 && s.length <= 200);
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

  return NextResponse.json({ sentences });
}
