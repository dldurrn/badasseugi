'use client';

import { browserSpeech, type SpeechProvider, type SpeechRate } from './tts';

/** 화면에서 고를 수 있는 속도. 이 세 가지 말고는 저장하지 않습니다. */
export const RATES: readonly SpeechRate[] = [0.65, 0.85, 1.0];
export const DEFAULT_RATE: SpeechRate = 0.85;

/**
 * 이 앱이 실제로 쓰는 음성 공급자.
 *
 * 서버(`/api/tts` → Google Cloud)를 먼저 쓰고, 안 되면 브라우저 내장 음성으로 넘어갑니다.
 *
 * **폴백은 조용히 합니다.** 아이가 쓰는 화면에 "음성 오류"가 뜨면 문제 푸는 걸 멈춥니다.
 * 소리가 조금 덜 자연스러워도 계속 들리는 쪽이 낫습니다. 원인은 서버 로그에만 남깁니다.
 *
 * 캐시가 필요한 이유
 * "또박또박 듣기"는 어절마다 따로 호출합니다. 5어절 문장 하나가 5번이고,
 * "선생님처럼 듣기"는 전체→어절→전체라 7번입니다.
 * 게다가 아이는 같은 문장을 여러 번 듣습니다.
 * 한 번 받은 소리를 담아 두면 그 세션 안에서는 다시 부르지 않습니다.
 */

/** 담아 둘 소리 개수. 10문장 세트 하나를 어절까지 다 담고도 남는 크기입니다. */
const MAX_CACHE = 80;

/** 설정에서 고른 목소리를 기억하는 자리 */
export const VOICE_STORAGE_KEY = 'badasseugi:voice';

/** 읽기 속도를 기억하는 자리 */
export const RATE_STORAGE_KEY = 'badasseugi:rate';

/** key = 목소리|속도|문장 */
const cache = new Map<string, string>();

/**
 * 서버 음성을 쓸 수 있는지.
 * null = 아직 모름 / false = 이 페이지에서는 더 시도하지 않음
 *
 * 키가 없는 경우(503)에만 false로 잠급니다.
 * 일시적인 네트워크 오류로 잠가 버리면, 잠깐 끊겼다는 이유로
 * 남은 세션 내내 내장 음성만 쓰게 됩니다.
 */
let serverUsable: boolean | null = null;

export function readVoice(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(VOICE_STORAGE_KEY);
}

export function writeVoice(name: string | null): void {
  if (typeof window === 'undefined') return;
  if (name) window.localStorage.setItem(VOICE_STORAGE_KEY, name);
  else window.localStorage.removeItem(VOICE_STORAGE_KEY);
  // 목소리가 바뀌면 담아 둔 소리는 옛 목소리라 버립니다.
  clearVoiceCache();
}

/**
 * 읽기 속도. 세션 화면에서 바꾼 값이 다음에도 이어지도록 기억합니다.
 *
 * 아이마다 알아듣는 속도가 다른데, 매번 처음부터 다시 고르게 하면
 * 느리게 들어야 하는 아이가 세션마다 같은 버튼을 다시 눌러야 합니다.
 */
export function readRate(): SpeechRate {
  if (typeof window === 'undefined') return DEFAULT_RATE;
  const raw = Number(window.localStorage.getItem(RATE_STORAGE_KEY));
  return (RATES as readonly number[]).includes(raw) ? (raw as SpeechRate) : DEFAULT_RATE;
}

export function writeRate(rate: SpeechRate): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RATE_STORAGE_KEY, String(rate));
}

export function clearVoiceCache(): void {
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
}

function remember(key: string, url: string): void {
  if (cache.size >= MAX_CACHE) {
    // 가장 오래된 것부터 버립니다. Map은 넣은 순서를 지킵니다.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      const stale = cache.get(oldest);
      if (stale) URL.revokeObjectURL(stale);
      cache.delete(oldest);
    }
  }
  cache.set(key, url);
}

type FetchResult =
  | { kind: 'ok'; url: string }
  /** 키가 없어 앞으로도 안 됨 */
  | { kind: 'disabled' }
  /** 이번만 실패 */
  | { kind: 'failed' };

async function fetchAudio(
  text: string,
  rate: number,
  signal: AbortSignal,
  gapMs = 0,
): Promise<FetchResult> {
  const voice = readVoice();
  // 쉼도 열쇠에 넣습니다. 이어서 읽은 소리와 또박또박 읽은 소리는 다른 소리입니다.
  const key = `${voice ?? ''}|${rate}|${gapMs}|${text}`;

  const hit = cache.get(key);
  if (hit) return { kind: 'ok', url: hit };

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, rate, voice, gapMs }),
      signal,
    });

    if (response.status === 503) return { kind: 'disabled' };
    if (!response.ok) return { kind: 'failed' };

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    remember(key, url);
    return { kind: 'ok', url };
  } catch {
    // 중단(abort) 포함. 이번 재생만 포기합니다.
    return { kind: 'failed' };
  }
}

function playUrl(url: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();

    const audio = new Audio(url);
    const done = () => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    };
    const onAbort = () => {
      audio.pause();
      done();
    };

    audio.onended = done;
    audio.onerror = done;
    signal.addEventListener('abort', onAbort, { once: true });

    // 재생은 언제나 아이가 버튼을 누른 뒤라 자동재생 정책에 걸리지 않습니다.
    void audio.play().catch(done);
  });
}

export const appSpeech: SpeechProvider = {
  isAvailable() {
    // 서버가 안 되면 브라우저 음성으로 넘어가므로, 둘 중 하나라도 되면 쓸 수 있습니다.
    return true;
  },

  async speak(text, rate, signal) {
    if (signal.aborted) return;

    if (serverUsable !== false) {
      const result = await fetchAudio(text, rate, signal);

      if (result.kind === 'ok') {
        serverUsable = true;
        await playUrl(result.url, signal);
        return;
      }
      // 키가 없는 경우에만 잠급니다. 일시적 실패는 다음에 다시 시도합니다.
      if (result.kind === 'disabled') serverUsable = false;
      if (signal.aborted) return;
    }

    await browserSpeech.speak(text, rate, signal);
  },

  /**
   * 어절 사이를 벌리되 한 문장으로 읽습니다.
   *
   * 서버가 SSML로 쉼을 넣어 한 번에 합성해 줍니다.
   * 낱말을 따로 합성하던 예전 방식보다 잘 들리고, 요청도 어절 수만큼이 아니라 한 번입니다.
   *
   * 서버가 안 되면 브라우저 음성으로 넘어가는데, 거기서는 쉼을 지정할 수 없어
   * 어쩔 수 없이 낱말을 하나씩 읽습니다.
   */
  async speakWithPauses(text, rate, gapMs, signal) {
    if (signal.aborted) return;

    if (serverUsable !== false) {
      const result = await fetchAudio(text, rate, signal, gapMs);

      if (result.kind === 'ok') {
        serverUsable = true;
        await playUrl(result.url, signal);
        return;
      }
      if (result.kind === 'disabled') serverUsable = false;
      if (signal.aborted) return;
    }

    for (const word of text.split(' ').filter(Boolean)) {
      if (signal.aborted) return;
      await browserSpeech.speak(word, rate, signal);
      if (signal.aborted) return;
      await new Promise((r) => window.setTimeout(r, gapMs));
    }
  },
};
