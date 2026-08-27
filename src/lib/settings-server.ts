import { cookies } from 'next/headers';
import {
  DEFAULT_SETTINGS,
  fromRow,
  resolveSettings,
  type Settings,
  type SettingsPatch,
} from './settings';
import { createClient } from './supabase/server';
import { matchVoice, pickEngines } from './tts-engines';

/**
 * 지금 화면에 쓸 설정을 읽어 옵니다.
 *
 * 서버 컴포넌트에서 부르고 화면에 props로 내려 줍니다.
 * 화면이 스스로 불러오면 **한 번 깜빡입니다** — 기본값으로 그렸다가 값이 오면 바뀌는데,
 * 그 사이에 아이가 이미 「문장 듣기」를 눌렀으면 옛 속도로 읽어 버립니다.
 *
 * **읽다가 잘못돼도 앱은 굴러가야 합니다.**
 * 칸이 아직 없거나(마이그레이션 전) 네트워크가 흔들려도 기본값으로 내려갑니다.
 * 설정을 못 읽었다고 아이가 받아쓰기를 못 하면 안 됩니다.
 */

const ACTIVE_CHILD_COOKIE = 'bs_child';

export interface LoadedSettings {
  /** 지금 실제로 쓸 값 — 아이 것 → 부모 기본값 → 앱 기본값 */
  effective: Settings;
  /** 부모가 정해 둔 기본값. 보호자 설정 화면이 이걸 그립니다. */
  family: SettingsPatch;
  /** 이 아이가 직접 고른 값. 아이가 없거나 안 골랐으면 비어 있습니다. */
  child: SettingsPatch;
}

const EMPTY: LoadedSettings = { effective: DEFAULT_SETTINGS, family: {}, child: {} };

export async function readSettings(): Promise<LoadedSettings> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return EMPTY;

    const childId = (await cookies()).get(ACTIVE_CHILD_COOKIE)?.value ?? null;

    // 두 층을 한 번에 물어봅니다. 아이가 없으면 부모 것만.
    const [familyRes, childRes] = await Promise.all([
      supabase
        .from('families')
        .select('default_rate, default_write_mode, default_voice')
        .eq('id', user.id)
        .maybeSingle(),
      childId
        ? supabase
            .from('children')
            .select('rate, write_mode, voice')
            .eq('id', childId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const family = fromRow(familyRes.data as Record<string, unknown> | null, 'family');
    const child = fromRow(childRes.data as Record<string, unknown> | null, 'child');

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
    const engine = pickEngines()[0] ?? null;
    const 옮김 = (v: string | null | undefined) =>
      engine && v ? matchVoice(engine, v) : (v ?? null);

    const resolved = resolveSettings(family, child);

    return {
      effective: { ...resolved, voice: 옮김(resolved.voice) },
      family: { ...family, voice: 옮김(family.voice) },
      child: { ...child, voice: 옮김(child.voice) },
    };
  } catch (error) {
    // 칸이 아직 없으면 여기로 옵니다. 조용히 기본값으로 갑니다.
    console.error('[settings] 읽지 못했습니다', error);
    return EMPTY;
  }
}
