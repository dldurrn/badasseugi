import { normalize } from '@/lib/hangul';
import { toDateKeyInSeoul } from './review';

/**
 * 받아쓰기 세트 입력값 다듬기.
 *
 * 화면과 서버가 같은 규칙을 써야 "내가 넣은 문장"과 "채점 기준"이 어긋나지 않습니다.
 * 채점 엔진이 쓰는 `normalize`를 여기서도 그대로 써서,
 * 저장된 문장이 곧 채점 기준이 되도록 맞춥니다.
 */

export const SET_NAME_MAX = 60;
export const SENTENCE_MAX = 200;
export const MAX_SENTENCES = 30;

export function normalizeSetName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.replace(/\s+/g, ' ').trim();
  if (value.length < 1 || value.length > SET_NAME_MAX) return null;
  return value;
}

/** 빈 줄은 버리고, 너무 긴 문장은 자르고, 개수 상한을 지킵니다. */
export function normalizeSentences(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const sentence = normalize(item).slice(0, SENTENCE_MAX);
    if (sentence.length === 0) continue;
    out.push(sentence);
    if (out.length >= MAX_SENTENCES) break;
  }
  return out;
}

/**
 * 오늘 날짜로 기본 세트 이름을 제안합니다. 이름 짓는 수고를 덜어 줍니다.
 *
 * **한국 날짜로 셉니다.** `getMonth()`·`getDate()` 는 도는 자리의 시간대를 쓰는데,
 * 이걸 부르는 것은 **서버 컴포넌트**(`/dictation/new`)이고 Vercel 은 UTC 로 돕니다.
 * 그래서 9월 1일 아침에 세트를 만들면 「8월 31일 받아쓰기」가 제안됐습니다.
 */
export function suggestSetName(d: Date = new Date()): string {
  const [, m, day] = toDateKeyInSeoul(d).split('-');
  return `${Number(m)}월 ${Number(day)}일 받아쓰기`;
}
