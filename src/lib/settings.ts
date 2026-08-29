import { DEFAULT_RATE, RATES, type SpeechRate } from './tts';
import { DEFAULT_WRITE_MODE, type WriteMode } from './write-mode';

/**
 * 아이가 푸는 방식 — 목소리·쓰기 방법·읽기 속도.
 *
 * **기기가 아니라 서버에 둡니다.**
 * 예전에는 브라우저 한 곳(localStorage)에 통으로 저장했는데 두 가지가 안 됐습니다.
 *
 *   1. 아이가 둘이면 한 값을 같이 씁니다. 아이별로 나눌 자리가 없었습니다.
 *   2. 부모 휴대폰에서 정한 것이 아이 패드로 넘어가지 않습니다.
 *      부모는 「분명히 목소리를 골랐는데 아이 화면에서는 다른 소리가 난다」고 겪습니다.
 *
 * 두 층입니다.
 *
 *   부모가 정한 기본값(families)  →  아이가 직접 고른 값(children)
 *
 * 아이 값이 비어 있으면 부모 기본값으로, 그것도 비어 있으면 앱 기본값으로 내려갑니다.
 * **비어 있음을 「안 골랐음」으로 씁니다.** 미리 채워 두면 부모가 나중에 기본값을 바꿔도
 * 이미 채워진 아이에게는 안 닿습니다.
 *
 * 효과음은 여기 없습니다. 「지금 이 자리에서 조용히 해야 하나」는
 * 아이의 성향이 아니라 그 순간의 사정이라 기기에 그대로 둡니다.
 */

export interface Settings {
  rate: SpeechRate;
  writeMode: WriteMode;
  /** null이면 그 회사의 기본 목소리 */
  voice: string | null;
}

/** 아무도 아무것도 안 골랐을 때 */
export const DEFAULT_SETTINGS: Settings = {
  rate: DEFAULT_RATE,
  writeMode: DEFAULT_WRITE_MODE,
  voice: null,
};

/**
 * 어느 회사 목소리로 읽을지.
 *
 * `auto` 는 서버가 정한 순서대로(타입캐스트 먼저, 막혔으면 Google).
 * 회사를 짚어도 **그 회사만 고집하지는 않습니다** — 막히면 다른 쪽으로 넘어갑니다.
 * 아이 화면에서 소리가 나는 것이 어느 회사냐보다 중요합니다.
 */
export type EnginePref = 'auto' | 'typecast' | 'google';

export const DEFAULT_ENGINE: EnginePref = 'auto';

/**
 * 한 층에 저장된 값. 안 고른 것은 없거나 null입니다.
 *
 * `engine` 만 **집 단위**라 부모 층에만 있습니다. 아이마다 다른 회사를 쓸 까닭이 없고,
 * 이건 아이의 학습 취향이 아니라 집의 선택(소리 질과 비용)입니다.
 */
export interface SettingsPatch {
  rate?: number | null;
  writeMode?: string | null;
  voice?: string | null;
  /** 부모 층에서만 씁니다. 아이 층에서는 언제나 비어 있습니다. */
  engine?: EnginePref | null;
}

/* ------------------------------------------------------------------ */
/* 들어온 값 다듬기                                                     */
/*                                                                     */
/* 서버가 돌려준 값도, 화면이 보낸 값도 여기를 거칩니다.                  */
/* DB에 제약을 걸어 두었지만 그것만 믿지 않습니다 — 옛 값이 남아 있거나    */
/* 화면이 잘못 보냈을 때 아이 화면이 깨지는 것보다 조용히 기본값이 낫습니다.*/
/* ------------------------------------------------------------------ */

export function cleanRate(value: unknown): SpeechRate | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  // 화면이 고를 수 있는 값만 받습니다. 사이값이 들어오면 안 고른 것으로 봅니다.
  return (RATES as readonly number[]).includes(n) ? (n as SpeechRate) : null;
}

export function cleanWriteMode(value: unknown): WriteMode | null {
  return value === 'wongoji' || value === 'plain' ? value : null;
}

export function cleanEngine(value: unknown): EnginePref | null {
  return value === 'auto' || value === 'typecast' || value === 'google' ? value : null;
}

/**
 * 목소리 이름은 회사마다 형태가 달라(`ko-KR-…` / `tc_…`) 여기서는 모양만 봅니다.
 * 지금 회사와 맞는지는 소리를 만들 때 `matchVoice`가 가립니다 —
 * 회사가 바뀌어도 남녀를 지켜서 옮기기 위해서입니다.
 */
export function cleanVoice(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v.length > 0 && v.length <= 80 ? v : null;
}

/**
 * 두 층을 겹쳐 지금 쓸 값을 정합니다.
 *
 * 아이가 고른 것 → 부모가 정한 기본값 → 앱 기본값 순서로 내려갑니다.
 * 항목마다 따로 내려갑니다 — 아이가 목소리만 골랐으면 속도는 부모 기본값을 씁니다.
 */
export function resolveSettings(
  family: SettingsPatch | null | undefined,
  child: SettingsPatch | null | undefined,
): Settings {
  return {
    rate: cleanRate(child?.rate) ?? cleanRate(family?.rate) ?? DEFAULT_SETTINGS.rate,
    writeMode:
      cleanWriteMode(child?.writeMode) ??
      cleanWriteMode(family?.writeMode) ??
      DEFAULT_SETTINGS.writeMode,
    voice: cleanVoice(child?.voice) ?? cleanVoice(family?.voice) ?? DEFAULT_SETTINGS.voice,
  };
}

/** 화면이 보낸 것 중 알아들을 수 있는 것만 남깁니다. 없는 항목은 건드리지 않습니다. */
export function cleanPatch(raw: unknown): SettingsPatch {
  const body = (raw ?? {}) as Record<string, unknown>;
  const patch: SettingsPatch = {};
  if ('rate' in body) patch.rate = cleanRate(body.rate);
  if ('writeMode' in body) patch.writeMode = cleanWriteMode(body.writeMode);
  if ('voice' in body) patch.voice = cleanVoice(body.voice);
  if ('engine' in body) patch.engine = cleanEngine(body.engine);
  return patch;
}

/** DB 칸 이름으로 옮깁니다. 층마다 이름이 다릅니다(families 는 default_ 가 붙습니다). */
export function toColumns(patch: SettingsPatch, scope: 'family' | 'child'): Record<string, unknown> {
  const p = scope === 'family' ? 'default_' : '';
  const row: Record<string, unknown> = {};
  if ('rate' in patch) row[`${p}rate`] = patch.rate;
  if ('writeMode' in patch) row[`${p}write_mode`] = patch.writeMode;
  if ('voice' in patch) row[`${p}voice`] = patch.voice;
  /*
    회사 고르기는 집 단위라 부모 층에만 저장합니다.
    아이 층으로 잘못 보내면 children 에 없는 칸이라 저장 전체가 실패합니다 —
    목소리를 바꾸려던 아이가 아무것도 못 바꾸게 됩니다. 조용히 버리는 편이 낫습니다.
  */
  if ('engine' in patch && scope === 'family') row.default_engine = patch.engine;
  return row;
}

/** DB 행에서 읽어 옵니다. 칸이 아직 없으면(마이그레이션 전) 전부 비어 있는 것으로 봅니다. */
export function fromRow(
  row: Record<string, unknown> | null | undefined,
  scope: 'family' | 'child',
): SettingsPatch {
  if (!row) return {};
  const p = scope === 'family' ? 'default_' : '';
  return {
    rate: cleanRate(row[`${p}rate`]),
    writeMode: cleanWriteMode(row[`${p}write_mode`]),
    voice: cleanVoice(row[`${p}voice`]),
    // 아이 층에는 이 칸이 없습니다. 없으면 그냥 비어 있는 것으로 봅니다.
    engine: scope === 'family' ? cleanEngine(row.default_engine) : null,
  };
}
