/**
 * 소리를 만들어 주는 바깥 서비스.
 *
 * `/api/tts`가 어느 회사를 쓸지는 **환경 변수로 정합니다.**
 * `TYPECAST_API_KEY`가 있으면 타입캐스트, 없으면 Google입니다.
 * 화면 코드는 어느 쪽인지 알 필요가 없습니다 — `/api/tts`만 부르면 됩니다.
 *
 * 두 회사의 차이가 여기 한 곳에 갇혀 있어야, 나중에 또 바꿀 때 이 파일만 보면 됩니다.
 */

export type EngineName = 'typecast' | 'google';

export interface SynthesisRequest {
  text: string;
  /** 우리 화면의 0.65 / 0.85 / 1.0 */
  rate: number;
  /** 목소리 식별자. 없으면 기본값 */
  voice: string;
  /** 어절 사이 쉼(ms). 0이면 이어서 읽습니다 */
  gapMs: number;
}

export interface SynthesisResult {
  /** 바로 응답 본문으로 쓸 수 있는 형태 */
  audio: ArrayBuffer;
  contentType: string;
  /** 회사가 실제로 세는 글자 수 (하루 한도 계산용) */
  billedChars: number;
}

/* ------------------------------------------------------------------ */
/* Google Cloud Text-to-Speech                                         */
/* ------------------------------------------------------------------ */

/** Buffer 는 더 큰 메모리를 나눠 쓰기도 해서, 우리 몫만 잘라 냅니다. */
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

const GOOGLE_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/** SSML 안에서 뜻을 갖는 글자를 막습니다. 큰따옴표를 그대로 넣으면 태그가 깨집니다. */
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
 * 낱말을 하나씩 따로 합성하면 TTS가 낱말마다 문장을 끝내듯 읽어 뚝뚝 끊깁니다.
 * 한 번에 보내면 문장 억양이 살아 있는 채로 사이만 벌어집니다.
 */
function googleChunkedSsml(text: string, gapMs: number): string {
  const gap = `<break time="${Math.round(gapMs)}ms"/>`;
  return `<speak>${text.split(' ').filter(Boolean).map(escapeSsml).join(gap)}</speak>`;
}

async function synthesizeWithGoogle(
  apiKey: string,
  req: SynthesisRequest,
): Promise<SynthesisResult> {
  const ssml = req.gapMs > 0 ? googleChunkedSsml(req.text, req.gapMs) : null;

  const response = await fetch(`${GOOGLE_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: ssml ? { ssml } : { text: req.text },
      voice: { languageCode: 'ko-KR', name: req.voice },
      audioConfig: { audioEncoding: 'MP3', speakingRate: req.rate },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google ${response.status} ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { audioContent?: string };
  if (!payload.audioContent) throw new Error('Google: audioContent 없음');

  return {
    audio: toArrayBuffer(Buffer.from(payload.audioContent, 'base64')),
    contentType: 'audio/mpeg',
    // Google은 SSML 태그까지 글자로 셉니다.
    billedChars: ssml ? ssml.length : req.text.length,
  };
}

/* ------------------------------------------------------------------ */
/* Typecast                                                            */
/* ------------------------------------------------------------------ */

const TYPECAST_ENDPOINT = 'https://api.typecast.ai/v1/text-to-speech';

/**
 * 타입캐스트에는 **쉼을 넣는 방법이 없습니다.**
 * SSML도, break 태그도 문서에 없고 실제로도 받지 않습니다.
 *
 * 그래서 어절 사이에 쉼표를 넣습니다. 사람이 읽을 때처럼 TTS도 쉼표에서 쉽니다.
 * 실제로 재 보니 「콧잔등에 땀이 송골송골」이 2.20초 → 2.80초로 늘었습니다.
 *
 * 쉼 길이를 정할 수는 없지만, 낱말을 따로 합성하는 것보다 훨씬 낫습니다 —
 * 문장 억양이 살아 있고 요청도 한 번이면 끝납니다.
 *
 * 원래 문장에 이미 쉼표가 있으면 겹치지 않게 그대로 둡니다.
 */
function typecastChunkedText(text: string): string {
  return text
    .split(' ')
    .filter(Boolean)
    .reduce((acc, word, i) => {
      if (i === 0) return word;
      // 앞 어절이 이미 쉼표나 마침표로 끝났으면 더 붙이지 않습니다.
      return /[,.!?…]$/.test(acc) ? `${acc} ${word}` : `${acc}, ${word}`;
    }, '');
}

async function synthesizeWithTypecast(
  apiKey: string,
  req: SynthesisRequest,
): Promise<SynthesisResult> {
  const text = req.gapMs > 0 ? typecastChunkedText(req.text) : req.text;

  const response = await fetch(TYPECAST_ENDPOINT, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voice_id: req.voice,
      model: 'ssfm-v30',
      text,
      /*
        감정(prompt)은 아예 보내지 않습니다.

        받아쓰기는 또박또박 읽어 주기만 하면 되고, 안 보내면 기본이 평범한 말투입니다.
        문서의 `{ preset, preset_intensity }` 형태로 보내면 422로 거절당합니다
        (실제로 던져 보고 알았습니다). 안 보내는 쪽이 탈이 없습니다.
      */
      output: {
        audio_format: 'mp3',
        // 우리 화면의 속도를 그대로 넘깁니다. 0.5~2.0 범위입니다.
        audio_tempo: Math.min(2, Math.max(0.5, req.rate)),
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Typecast ${response.status} ${detail.slice(0, 200)}`);
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: 'audio/mpeg',
    // 크레딧 1개 = 글자 1개. 쉼표도 글자라 보낸 그대로 셉니다.
    billedChars: text.length,
  };
}

/* ------------------------------------------------------------------ */
/* 고르기                                                               */
/* ------------------------------------------------------------------ */

export interface Engine {
  name: EngineName;
  /** 아무것도 고르지 않았을 때 쓸 목소리 */
  defaultVoice: string;
  /** 목소리 식별자로 받아들일 형태 */
  voicePattern: RegExp;
  /** 하루에 허용할 글자 수 */
  dailyLimit: number;
  synthesize(req: SynthesisRequest): Promise<SynthesisResult>;
}

/**
 * 쓸 수 있는 회사를 고릅니다. 키가 하나도 없으면 null입니다.
 *
 * 타입캐스트를 앞에 둔 이유는 한국어 전용 목소리가 있어서입니다.
 * 키를 지우면 곧바로 Google로 돌아갑니다 — 되돌리기가 쉬워야 합니다.
 */
export function pickEngine(): Engine | null {
  const typecastKey = process.env.TYPECAST_API_KEY;
  if (typecastKey) {
    return {
      name: 'typecast',
      defaultVoice: process.env.TYPECAST_VOICE_ID ?? DEFAULT_TYPECAST_VOICE,
      voicePattern: /^(tc|uc)_[0-9a-f]{24}$/,
      // 무료 한도가 월 15,000자입니다. 서른으로 나눠 하루치를 잡습니다.
      dailyLimit: Number(process.env.TTS_DAILY_LIMIT ?? 500),
      synthesize: (req) => synthesizeWithTypecast(typecastKey, req),
    };
  }

  const googleKey = process.env.GOOGLE_TTS_API_KEY;
  if (googleKey) {
    return {
      name: 'google',
      defaultVoice: DEFAULT_GOOGLE_VOICE,
      voicePattern: /^ko-KR-[\w-]{1,40}$/,
      dailyLimit: Number(process.env.TTS_DAILY_LIMIT ?? 20000),
      synthesize: (req) => synthesizeWithGoogle(googleKey, req),
    };
  }

  return null;
}

/** Google 기본 목소리 — 한국어 Chirp3 30개 중 흔들림이 가장 작습니다. */
export const DEFAULT_GOOGLE_VOICE = 'ko-KR-Chirp3-HD-Gacrux';

/**
 * 타입캐스트에서 고를 수 있게 둘 목소리.
 *
 * **API가 목소리에 언어 정보를 주지 않습니다.**
 * 돌려주는 필드가 voice_id, voice_name, model, emotions, voice_type 뿐이라
 * 1,125개 중 어느 것이 한국어인지 알 방법이 없습니다.
 * 그래서 한국 이름으로 후보를 추리고 실제로 읽혀 본 것만 여기 적어 둡니다.
 *
 * 새 목소리를 넣고 싶으면 여기에 한 줄 더하면 됩니다.
 */
export const TYPECAST_VOICES = [
  { id: 'tc_60915b5616d74069af8e8cab', name: '보미', gender: 'FEMALE' },
  { id: 'tc_65cd94c242e2d9d9c9c905e7', name: '은하', gender: 'FEMALE' },
  { id: 'tc_5ebea251fcf5110007b77d0f', name: '다희', gender: 'FEMALE' },
  { id: 'tc_68785db8ba9cd7503f27d921', name: '고운', gender: 'FEMALE' },
  { id: 'tc_660e45ff50e0ecacaf967d22', name: '은빈', gender: 'FEMALE' },
  { id: 'tc_644a05b537254553823492fb', name: '도희', gender: 'FEMALE' },
  { id: 'tc_6243fb7beec1a1bff3cfe6c4', name: '다솜', gender: 'FEMALE' },
  { id: 'tc_67513c3cf30802da48949a14', name: '아린', gender: 'FEMALE' },
  { id: 'tc_618203f635ea62f8574c7d8a', name: '보라', gender: 'FEMALE' },
  { id: 'tc_692799c46508f6b9468c54c7', name: '다은', gender: 'FEMALE' },
  { id: 'tc_6788847e9939d48aeb8642d2', name: '해랑', gender: 'FEMALE' },
  { id: 'tc_609a8f4362c4bdb3363bbfad', name: '채아', gender: 'FEMALE' },
  { id: 'tc_69fc0cff784968297fb45daa', name: '상현', gender: 'MALE' },
  { id: 'tc_66d000ee0742c43c93a0ada1', name: '도현', gender: 'MALE' },
  { id: 'tc_630494401f5003bebbfdafe3', name: '해준', gender: 'MALE' },
  { id: 'tc_6596849ea3ecaa12a8b13989', name: '봉규', gender: 'MALE' },
] as const;

/**
 * 타입캐스트 기본 목소리.
 * 아직 귀로 고른 값이 아닙니다 — 들어 보고 정하면 `TYPECAST_VOICE_ID`로 바꾸거나 여기를 고칩니다.
 */
export const DEFAULT_TYPECAST_VOICE = TYPECAST_VOICES[0].id;
