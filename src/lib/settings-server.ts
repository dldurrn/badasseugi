import {
  DEFAULT_ENGINE,
  DEFAULT_SETTINGS,
  type EnginePref,
  cleanEngine,
  fromRow,
  resolveSettings,
  type Settings,
  type SettingsPatch,
} from './settings';
import { activeChildRow, familyRow } from './request-context';
import { matchVoice, pickEngines } from './tts-engines';

/**
 * 지금 화면에 쓸 설정을 읽어 옵니다.
 *
 * 서버 컴포넌트에서 부르고 화면에 props로 내려 줍니다.
 * 화면이 스스로 불러오면 **한 번 깜빡입니다** — 기본값으로 그렸다가 값이 오면 바뀌는데,
 * 그 사이에 아이가 이미 「문장 듣기」를 눌렀으면 옛 속도로 읽어 버립니다.
 *
 * **행은 요청 캐시에서 가져옵니다**(request-context.ts).
 * 프로필도 같은 자녀 행을 보므로, 화면 하나에서 같은 줄을 두 번 읽지 않습니다.
 * 예전에는 여기서 로그인 확인까지 따로 해서 도쿄를 세 번 더 다녀왔습니다.
 *
 * **읽다가 잘못돼도 앱은 굴러가야 합니다.**
 * 칸이 아직 없거나(마이그레이션 전) 네트워크가 흔들려도 기본값으로 내려갑니다.
 * 설정을 못 읽었다고 아이가 받아쓰기를 못 하면 안 됩니다.
 */

export interface LoadedSettings {
  /** 지금 실제로 쓸 값 — 아이 것 → 부모 기본값 → 앱 기본값 */
  effective: Settings;
  /** 부모가 정해 둔 기본값. 보호자 설정 화면이 이걸 그립니다. */
  family: SettingsPatch;
  /** 이 아이가 직접 고른 값. 아이가 없거나 안 골랐으면 비어 있습니다. */
  child: SettingsPatch;
}

/**
 * 부모가 고른 회사. 소리를 만드는 라우트가 씁니다.
 *
 * 화면이 보낸 값을 쓰지 않는 이유는 설정 저장 때와 같습니다 —
 * 어느 회사로 읽을지는 집의 선택이고, 나중에 요금제가 켜지면
 * 「무료는 Google」 같은 규칙이 여기에 걸립니다. 화면이 정하게 두면 그때 구멍이 됩니다.
 */
export async function readEnginePref(): Promise<EnginePref> {
  const row = await familyRow();
  return cleanEngine(row?.default_engine) ?? DEFAULT_ENGINE;
}

export async function readSettings(): Promise<LoadedSettings> {
  const [가족, 자녀] = await Promise.all([familyRow(), activeChildRow()]);

  const family = fromRow(가족 as Record<string, unknown> | null, 'family');
  const child = fromRow(자녀 as Record<string, unknown> | null, 'child');

  /*
    저장된 목소리를 **지금 회사의 이름으로 옮겨 둡니다.**

    목소리 이름은 회사마다 형태가 다릅니다(`tc_…` / `ko-KR-…`).
    공급자가 바뀌면 예전에 고른 이름이 지금 목록에 하나도 없게 되는데,
    그대로 화면에 내려보내면 **아무것도 안 켜진 목록**이 나옵니다 —
    부모는 "내가 골라 둔 게 사라졌나" 하고, 지금 뭘로 읽는지도 알 수 없습니다.

    소리를 만들 때 쓰는 것과 **같은 함수**로 옮깁니다. 남녀는 지키고,
    못 알아보면 그 회사의 기본 목소리가 됩니다. 화면과 실제 소리가 갈리지 않습니다.

    저장은 하지 않습니다. 다시 타입캐스트로 돌아가면 원래 고른 목소리가 살아나야 합니다.
  */
  // 부모가 고른 회사를 반영해서 골라야, 화면에 켜지는 목소리가 실제로 날 소리와 같습니다.
  const engine = pickEngines(family.engine)[0] ?? null;
  const 옮김 = (v: string | null | undefined) =>
    engine && v ? matchVoice(engine, v) : (v ?? null);

  const resolved = resolveSettings(family, child);

  return {
    effective: { ...resolved, voice: 옮김(resolved.voice) },
    family: { ...family, voice: 옮김(family.voice) },
    child: { ...child, voice: 옮김(child.voice) },
  };
}

/** 아무것도 못 읽었을 때의 값. 화면이 이걸 받아도 정상으로 굴러갑니다. */
export const EMPTY_SETTINGS: LoadedSettings = {
  effective: DEFAULT_SETTINGS,
  family: {},
  child: {},
};
