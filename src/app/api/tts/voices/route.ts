import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api';
import { pickEngine, TYPECAST_VOICES } from '@/lib/tts-engines';

/**
 * 이 계정에서 쓸 수 있는 한국어 목소리 목록.
 *
 * 회사마다 사정이 다릅니다.
 * - Google: 목록을 물어보면 언어별로 걸러서 줍니다. 목소리가 늘고 줄어도 코드를 안 고쳐도 됩니다.
 * - 타입캐스트: **언어 정보를 주지 않습니다.** 1,125개를 통째로 줄 뿐이라
 *   어느 것이 한국어인지 알 수가 없습니다. 그래서 손으로 고른 목록을 씁니다.
 *
 * 화면은 어느 회사인지 모른 채 `{ name, label, gender }`만 받습니다.
 */

const GOOGLE_ENDPOINT = 'https://texttospeech.googleapis.com/v1/voices?languageCode=ko-KR';

export interface VoiceOption {
  /** 합성할 때 그대로 되돌려 보낼 식별자 */
  name: string;
  /** 화면에 보일 이름. 없으면 화면이 알아서 짓습니다 */
  label?: string;
  /** MALE / FEMALE / NEUTRAL */
  gender: string;
}

export async function GET() {
  const engine = pickEngine();
  if (!engine) return NextResponse.json({ voices: [], engine: null, defaultVoice: null });

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  if (engine.name === 'typecast') {
    return NextResponse.json({
      engine: 'typecast',
      defaultVoice: engine.defaultVoice,
      voices: TYPECAST_VOICES.map((v) => ({ name: v.id, label: v.name, gender: v.gender })),
    });
  }

  try {
    const response = await fetch(`${GOOGLE_ENDPOINT}&key=${process.env.GOOGLE_TTS_API_KEY}`);
    if (!response.ok) {
      console.error('[tts] 목소리 목록 실패', response.status);
      return NextResponse.json({ voices: [], engine: 'google', defaultVoice: engine.defaultVoice });
    }

    const payload = (await response.json()) as {
      voices?: Array<{ name?: string; ssmlGender?: string }>;
    };

    const voices: VoiceOption[] = (payload.voices ?? [])
      .filter((v): v is { name: string; ssmlGender?: string } => typeof v.name === 'string')
      .map((v) => ({ name: v.name, gender: v.ssmlGender ?? 'NEUTRAL' }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ voices, engine: 'google', defaultVoice: engine.defaultVoice });
  } catch (error) {
    console.error('[tts] 목소리 목록 실패', error);
    return NextResponse.json({ voices: [], engine: 'google', defaultVoice: engine.defaultVoice });
  }
}
