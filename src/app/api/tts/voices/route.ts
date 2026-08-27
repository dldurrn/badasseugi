import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api';
import { GOOGLE_VOICES, pickEngine, TYPECAST_VOICES } from '@/lib/tts-engines';

/**
 * 이 계정에서 쓸 수 있는 한국어 목소리 목록.
 *
 * **회사가 무엇이든 여자·남자 둘만 냅니다.** 손으로 고른 목록입니다.
 *
 * 타입캐스트는 언어 정보를 아예 주지 않아 1,125개 중 한국어를 가릴 방법이 없고,
 * Google은 걸러 주긴 하지만 한국어 Chirp3만 41개에 이름이 `ko-KR-Chirp3-HD-Achernar` 꼴입니다.
 * 사정은 다르지만 부모가 겪는 것은 같습니다 — 무엇을 고르는지 알 수 없다는 것.
 * 고른 근거는 `tts-engines.ts`의 두 목록에 적어 두었습니다.
 *
 * 화면은 어느 회사인지 모른 채 `{ name, label, gender }`만 받습니다.
 */

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

  /*
    회사가 무엇이든 **여자·남자 둘만** 보여 줍니다.

    Google은 언어로 걸러 주니 목록을 그대로 낼 수도 있습니다.
    그런데 한국어 Chirp3만 41개이고 이름이 `ko-KR-Chirp3-HD-Achernar` 꼴이라,
    부모가 무엇을 고르는지 알 수 없습니다. 한 번 정하면 그만인 설정이라
    고를 거리를 늘리는 것이 도움이 되지 않습니다.

    무엇보다 **회사가 바뀌었다고 설정 화면이 달라 보이면 안 됩니다.**
    타입캐스트가 막혀 Google로 넘어간 날, 부모에게는 목소리가
    둘에서 마흔하나로 늘어난 것으로 보일 테니까요.
  */
  const list = engine.name === 'typecast' ? TYPECAST_VOICES : GOOGLE_VOICES;
  return NextResponse.json({
    engine: engine.name,
    defaultVoice: engine.defaultVoice,
    voices: list.map((v) => ({ name: v.id, label: v.name, gender: v.gender })),
  });
}
