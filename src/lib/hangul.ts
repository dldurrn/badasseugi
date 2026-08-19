/**
 * 한글 음절 분해·분석 유틸리티
 *
 * 받아쓰기 채점의 기반이 되는 모듈입니다.
 * 초성/중성/종성 단위로 비교해야 "받침만 틀렸다", "모음만 틀렸다" 같은
 * 구체적인 피드백을 줄 수 있습니다.
 */

export const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

export const JUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const;

export const JONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_COUNT = 11172;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

export interface Jamo {
  cho: string;
  jung: string;
  jong: string;
}

/** 완성형 한글 음절 1글자를 초성·중성·종성으로 분해합니다. 한글이 아니면 null. */
export function decompose(ch: string): Jamo | null {
  if (!ch) return null;
  const code = ch.codePointAt(0);
  if (code === undefined) return null;
  const offset = code - SYLLABLE_BASE;
  if (offset < 0 || offset >= SYLLABLE_COUNT) return null;
  return {
    cho: CHO[Math.floor(offset / (JUNG_COUNT * JONG_COUNT))],
    jung: JUNG[Math.floor((offset % (JUNG_COUNT * JONG_COUNT)) / JONG_COUNT)],
    jong: JONG[offset % JONG_COUNT],
  };
}

/** 초성·중성·종성을 완성형 음절로 조합합니다. */
export function compose({ cho, jung, jong }: Jamo): string {
  const ci = CHO.indexOf(cho as (typeof CHO)[number]);
  const ji = JUNG.indexOf(jung as (typeof JUNG)[number]);
  const ti = JONG.indexOf((jong ?? '') as (typeof JONG)[number]);
  if (ci < 0 || ji < 0 || ti < 0) return '';
  return String.fromCodePoint(
    SYLLABLE_BASE + ci * JUNG_COUNT * JONG_COUNT + ji * JONG_COUNT + ti,
  );
}

/** 완성형 한글 음절인지 확인합니다. */
export function isSyllable(ch: string): boolean {
  return decompose(ch) !== null;
}

/** "갔" → "ㄱ + ㅏ + ㅆ" 형태의 학습용 표기를 만듭니다. */
export function spellOut(ch: string): string {
  const d = decompose(ch);
  if (!d) return ch;
  return d.jong ? `${d.cho} + ${d.jung} + ${d.jong}` : `${d.cho} + ${d.jung}`;
}

/** 문장부호 판별 (채점 시 '기호' 오류로 분류). */
const PUNCT_RE = /[.,!?~…:;·'"“”‘’「」『』()[\]{}\-–—]/;

export function isPunctuation(ch: string): boolean {
  return PUNCT_RE.test(ch);
}

/**
 * 채점 전 문장 정규화.
 * - 앞뒤 공백 제거
 * - 연속된 공백을 하나로
 * - 유니코드 정규화(NFC)로 조합형/완성형 차이 흡수
 *
 * 주의: 문장부호는 제거하지 않습니다. 받아쓰기에서 마침표·물음표는 채점 대상입니다.
 */
export function normalize(s: string): string {
  return (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}
