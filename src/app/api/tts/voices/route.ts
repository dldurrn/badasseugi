import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api';

/**
 * 이 계정에서 쓸 수 있는 한국어 목소리 목록.
 *
 * 목소리 이름을 코드에 적어 두지 않고 물어보는 이유는,
 * Google이 목소리를 계속 추가·정리하기 때문입니다.
 * 설정 화면이 이 목록을 그대로 보여 주면 목록이 바뀌어도 코드를 고칠 일이 없습니다.
 */

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/voices?languageCode=ko-KR';

export interface VoiceOption {
  name: string;
  /** MALE / FEMALE / NEUTRAL */
  gender: string;
}

export async function GET() {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return NextResponse.json({ voices: [] });

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const response = await fetch(`${ENDPOINT}&key=${apiKey}`);
    if (!response.ok) {
      console.error('[tts] 목소리 목록 실패', response.status);
      return NextResponse.json({ voices: [] });
    }

    const payload = (await response.json()) as {
      voices?: Array<{ name?: string; ssmlGender?: string }>;
    };

    const voices: VoiceOption[] = (payload.voices ?? [])
      .filter((v): v is { name: string; ssmlGender?: string } => typeof v.name === 'string')
      .map((v) => ({ name: v.name, gender: v.ssmlGender ?? 'NEUTRAL' }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ voices });
  } catch (error) {
    console.error('[tts] 목소리 목록 실패', error);
    return NextResponse.json({ voices: [] });
  }
}
