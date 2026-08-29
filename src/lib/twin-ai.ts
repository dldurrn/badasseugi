import { ERROR_LABEL, type ErrorType } from './grading';
import { chooseTwin } from './twin';

/**
 * 받아쓰기 짝 문장을 AI 로 만듭니다.
 *
 * **이 파일이 AI 가 닿는 유일한 자리입니다.**
 * 통째로 들어내도 맞춤법 짝(`twin.ts` 의 문제은행 고르기)은 그대로 돕니다.
 * 요금제로 나눌 자리도 여기 하나뿐입니다.
 *
 * 만든 것을 그대로 쓰지 않습니다 — `chooseTwin` 이 내장 문제은행에 걸어 둔 것과
 * **같은 기준**으로 거릅니다. AI 는 내고, 판정은 우리 규칙이 합니다.
 */

/** 후보를 셋 받습니다. 하나만 받으면 떨어질 때마다 다시 불러야 하고, 그동안 아이가 기다립니다. */
const WANT = 3;

export interface TwinRequest {
  /** 아이가 틀린 원래 문장 */
  origin: string;
  /** 아이가 실제로 쓴 것. 없으면 유형만으로 만듭니다 */
  wrongInput: string | null;
  errorTypes: ErrorType[];
  /** 이미 낸 짝들. 같은 것을 또 내지 않게 */
  used: string[];
}

function buildPrompt(req: TwinRequest): string {
  const 유형 = req.errorTypes.map((t) => `${t}(${ERROR_LABEL[t] ?? t})`).join(', ');

  return `초등학교 1~2학년 받아쓰기 문장을 만들어 주세요.

아이가 이 문장을 틀렸습니다.
- 원래 문장: ${req.origin}
${req.wrongInput ? `- 아이가 쓴 것: ${req.wrongInput}` : ''}
- 틀린 갈래: ${유형 || '알 수 없음'}

**같은 규칙을 연습시키는 다른 문장**을 ${WANT}개 만들어 주세요.
아이가 무엇을 헷갈렸는지 보고, 그 헷갈림이 다시 나오는 문장이어야 합니다.
${req.used.length > 0 ? `\n이미 낸 것이라 쓰면 안 되는 문장: ${req.used.join(' / ')}` : ''}

반드시 지킬 것:
1. **원고지 한 줄(15칸)에 들어가야 합니다.** 글자와 공백과 문장부호를 모두 세어 15칸 이하.
1-1. **원래 문장과 길이가 비슷해야 합니다.** 낱말 하나였으면 낱말 하나로,
     짧은 문장이었으면 짧은 문장으로. 더 어렵게 내면 안 됩니다.
2. 초등 1~2학년이 아는 낱말만. **눈에 보이고 손에 잡히는 것**을 쓰세요 —
   먹는 것, 동물, 학교, 집, 놀이처럼요.
   「포기했어요」「결심했어요」같은 마음속 낱말과 한자어는 쓰지 마세요.
2-1. 원래 문장에 **겹받침**(닭·값·읽다·삶·여덟)이 있으면 짝에도 겹받침을 넣으세요.
   받침이 있기만 한 문장으로는 그 아이가 헷갈린 자리를 연습시키지 못합니다.
3. 원래 문장과 낱말이 겹쳐도 되지만 **같은 문장이면 안 됩니다.**
4. 영어와 숫자는 쓰지 마세요.
5. 「개/게」「새/세」「배/베」「매/메」처럼 소리가 같은 낱말을 **낱말 하나만** 쓰지 마세요.
   귀로 구분할 수 없어 아이가 무엇을 써도 정답이 됩니다. 문장 안에 넣는 것은 괜찮습니다.
6. 실제로 쓰는 바른 한국어여야 합니다. 맞춤법과 띄어쓰기를 정확히 지켜 주세요.

다른 설명 없이 아래 형태의 JSON 만 답하세요.
{"candidates":[{"sentence":"흙을 만졌어요","why":"ㄺ 겹받침"}]}`;
}

/**
 * 후보를 받아 거르고, 통과한 문장 하나를 돌려줍니다.
 *
 * 하나도 통과 못 하거나 부를 수 없으면 null 입니다.
 * 그때는 **예전 동작(원본을 두 번)으로 조용히 내려갑니다** — 아이 화면에는 아무 일도 없습니다.
 */
export async function makeTwin(req: TwinRequest): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  let candidates: string[];
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        /*
          짧은 문장 몇 개를 만드는 일이라 가장 빠르고 싼 모델로 충분합니다.
          어차피 판정은 우리 규칙이 하므로, 모델이 해야 할 일은 후보를 대는 것뿐입니다.
        */
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: buildPrompt(req) }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic ${response.status}`);

    const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (payload.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .replace(/```json|```/g, '')
      .trim();

    const parsed = JSON.parse(text) as { candidates?: Array<{ sentence?: unknown }> };
    candidates = (parsed.candidates ?? [])
      .map((c) => (typeof c?.sentence === 'string' ? c.sentence.replace(/\s+/g, ' ').trim() : ''))
      .filter((s) => s.length > 0)
      .slice(0, WANT);
  } catch (error) {
    // 짝이 없어도 앱은 굴러갑니다. 아이 화면에 오류를 띄우지 않습니다.
    console.error('[twin] 문장을 만들지 못했습니다', error);
    return null;
  }

  const { sentence, rejects } = chooseTwin(candidates, req.origin, req.errorTypes);
  if (!sentence) {
    // 왜 떨어졌는지 남깁니다. 프롬프트를 고칠 단서는 이것뿐입니다.
    console.warn('[twin] 후보가 모두 떨어졌습니다', JSON.stringify(rejects));
  }
  return sentence;
}
