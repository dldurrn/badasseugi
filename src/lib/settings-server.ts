import { cookies } from 'next/headers';
import {
  DEFAULT_SETTINGS,
  fromRow,
  resolveSettings,
  type Settings,
  type SettingsPatch,
} from './settings';
import { createClient } from './supabase/server';

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

    return { effective: resolveSettings(family, child), family, child };
  } catch (error) {
    // 칸이 아직 없으면 여기로 옵니다. 조용히 기본값으로 갑니다.
    console.error('[settings] 읽지 못했습니다', error);
    return EMPTY;
  }
}
