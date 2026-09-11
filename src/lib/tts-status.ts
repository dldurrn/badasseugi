import type { EnginePref } from '@/lib/settings';

/**
 * 「지금 무엇으로 읽고 있나」를 부모에게 **사실대로** 말하는 규칙.
 *
 * 화면(VoiceSettings)에서 떼어 두었습니다. 여기 담긴 것은 그리는 방법이 아니라
 * **무엇을 말해도 되고 무엇은 말하면 안 되는가**라, 테스트로 못 박아 둘 값어치가 있습니다.
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 생겼나
 *
 * 예전에는 서버의 `pickEngine` 결과를 그대로 「지금 …로 읽고 있어요」라고 적었습니다.
 * 그건 **합성을 한 번도 해 보지 않은 예정**입니다.
 *
 * 실제로 타입캐스트가 403(UNUSUAL_ACTIVITY_DETECTED)으로 막혀 Google 이 읽던
 * 며칠 동안, 설정 화면은 「지금 Typecast 로 읽고 있어요」라고 말하고 있었습니다.
 * 소리는 정상적으로 났기 때문에 `FallbackNote` 에도 안 잡혔고
 * (그건 브라우저 내장 음성으로 떨어질 때만 남습니다), 부모는 알 길이 없었습니다.
 *
 * **안 알리는 것보다 나쁩니다 — 잘못 알리니까요.**
 */

/**
 * 회사 이름은 영어 그대로 씁니다.
 *
 * 「타입캐스트」로 적으면 부모가 검색해 볼 때 안 나옵니다 —
 * 요금제를 보러 가거나 지원에 물어볼 때 쓰는 이름은 영어 쪽입니다.
 */
export const ENGINE_LABEL: Record<string, string> = {
  typecast: 'Typecast',
  google: 'Google',
};

export const engineName = (id: string): string => ENGINE_LABEL[id] ?? id;

export interface EngineLine {
  text: string;
  /** 부모가 손을 써야 하는 상태인가. 화면이 빨간펜 색으로 짚습니다 */
  warn: boolean;
}

/**
 * @param planned 서버가 1순위로 고른 회사. **예정이지 사실이 아닙니다**
 * @param served  이 기기에서 마지막으로 **실제로** 읽어 준 회사. 없으면 아직 안 들은 것
 * @param pref    부모가 골라 둔 것. 'auto' 면 고른 것이 없습니다
 */
export function engineLine(planned: string, served: string | null, pref: EnginePref): EngineLine {
  /*
    아직 이 기기에서 한 번도 안 들었으면 **예정이라고 말합니다.**
    여기서 「읽고 있어요」라고 하면 그게 바로 예전의 거짓말입니다.
  */
  if (!served) return { text: `${engineName(planned)}를 먼저 시도해요`, warn: false };

  /*
    고른 회사가 있는데 다른 회사가 읽었다면, 그게 지금 부모가 알아야 할 전부입니다.
    회사끼리의 폴백은 소리가 나기 때문에 이 줄이 아니면 드러날 곳이 없습니다.
  */
  if (pref !== 'auto' && served !== pref) {
    return {
      text: `고르신 ${engineName(pref)}가 막혀서 ${engineName(served)}로 읽고 있어요`,
      warn: true,
    };
  }

  /*
    「자동」으로 두었으면 어느 쪽이 읽든 어긋난 것이 아닙니다 — 알아서 고르라고 한 것이니까요.
    그래도 무엇이 읽었는지는 말해 줍니다. 부모가 소리를 듣고 「이게 어느 쪽이지」 할 때
    답을 찾을 곳이 여기뿐입니다.
  */
  return { text: `방금 ${engineName(served)}로 읽었어요`, warn: false };
}
