'use client';

import { browserSpeech, DEFAULT_RATE, RATES, type SpeechProvider, type SpeechRate } from './tts';

/* 속도 값은 tts.ts 가 갖습니다 — 서버(설정 읽기)에서도 써야 해서입니다.
   여기서 다시 내보내는 것은 부르던 곳들을 그대로 두기 위해서입니다. */
export { RATES, DEFAULT_RATE };

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

/** key = 목소리|속도|쉼|문장 */
const cache = new Map<string, string>();

/**
 * 서버 음성을 쓸 수 있는지.
 * null = 아직 모름 / false = 이 페이지에서는 더 시도하지 않음
 *
 * 키가 없는 경우(503)와 공급자가 막은 경우(403)에만 false로 잠급니다.
 * 일시적인 네트워크 오류로 잠가 버리면, 잠깐 끊겼다는 이유로
 * 남은 세션 내내 내장 음성만 쓰게 됩니다.
 */
let serverUsable: boolean | null = null;

/**
 * 지금 쓸 목소리.
 *
 * 예전에는 브라우저에 저장해 두고 여기서 읽었습니다. 이제는 **서버가 갖습니다** —
 * 아이마다 다르고, 부모 휴대폰에서 정한 것이 아이 패드로도 따라와야 하기 때문입니다.
 * 서버 컴포넌트가 읽어 화면에 내려 주면, 화면이 뜰 때 여기에 한 번 꽂아 둡니다.
 *
 * 모듈 한 곳에 두는 이유는 소리를 만드는 자리가 화면에서 멀기 때문입니다 —
 * `SpeechController.play(text, rate, style)`까지 목소리를 들고 다니게 하면
 * 부르는 곳마다 인자가 하나씩 늘어납니다.
 */
let activeVoice: string | null = null;

export function setActiveVoice(voice: string | null): void {
  if (voice === activeVoice) return;
  activeVoice = voice;
  // 목소리가 바뀌면 담아 둔 소리는 옛 목소리라 버립니다.
  clearVoiceCache();
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
  | { kind: 'failed'; status?: number };

/* ------------------------------------------------------------------ */
/* 서버 음성이 안 될 때 부모에게 알리기                                  */
/* ------------------------------------------------------------------ */

const FALLBACK_KEY = 'badasseugi:tts-fallback';

/** 왜 서버 음성을 못 썼는지 */
export type FallbackReason = 'not-configured' | 'daily-limit' | 'blocked' | 'failed';

export interface FallbackNote {
  reason: FallbackReason;
  /** 마지막으로 넘어간 때 */
  at: number;
}

/**
 * 아이 화면에는 아무것도 띄우지 않지만, **부모는 알아야 합니다.**
 *
 * 서버 음성이 안 되면 브라우저 내장 음성으로 조용히 넘어갑니다(그게 맞습니다 —
 * 아이가 문제 풀다 "음성 오류"를 보면 거기서 멈춥니다).
 * 문제는 그 조용함 때문에 **며칠째 내장 음성으로 읽고 있어도 아무도 모른다**는 것입니다.
 *
 * 그래서 넘어간 사실만 기기에 적어 두고, 보호자 설정 화면에서 보여 줍니다.
 * 다음에 서버 음성이 되면 지웁니다.
 */
function noteFallback(reason: FallbackReason): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify({ reason, at: Date.now() }));
  } catch {
    // 저장 공간이 막혀 있어도 소리는 나야 합니다.
  }
}

function clearFallback(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(FALLBACK_KEY);
  } catch {
    /* 무시 */
  }
}

/** 보호자 설정 화면이 읽습니다. */
export function readFallback(): FallbackNote | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FallbackNote>;
    if (typeof parsed.at !== 'number' || !parsed.reason) return null;
    return { reason: parsed.reason, at: parsed.at };
  } catch {
    return null;
  }
}

/** 상태를 다시 재고 싶을 때(보호자 화면의 "다시 확인") */
export function forgetFallback(): void {
  clearFallback();
}

async function fetchAudio(
  text: string,
  rate: number,
  signal: AbortSignal,
  gapMs = 0,
): Promise<FetchResult> {
  const voice = activeVoice;
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
    if (!response.ok) return { kind: 'failed', status: response.status };

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

/**
 * 서버 음성을 시도하고 됐으면 재생합니다.
 *
 * 안 됐으면 **왜 안 됐는지 적어 두고** false를 돌려줍니다.
 * 부르는 쪽은 그때 브라우저 음성으로 넘어가면 됩니다.
 *
 * 중단(아이가 다음 문제로 넘어가거나 다시 누른 경우)은 실패로 적지 않습니다.
 * 그걸 적으면 정상으로 쓰는 동안에도 경고가 뜹니다.
 */
async function playFromServer(
  text: string,
  rate: number,
  gapMs: number,
  signal: AbortSignal,
): Promise<boolean> {
  if (serverUsable === false) return false;

  const result = await fetchAudio(text, rate, signal, gapMs);

  if (result.kind === 'ok') {
    serverUsable = true;
    clearFallback();
    await playUrl(result.url, signal);
    return true;
  }

  if (signal.aborted) return false;

  if (result.kind === 'disabled') {
    // 키가 없는 경우에만 잠급니다. 일시적 실패로 잠가 버리면
    // 잠깐 끊겼다는 이유로 남은 세션 내내 내장 음성만 쓰게 됩니다.
    serverUsable = false;
    noteFallback('not-configured');
  } else if (result.status === 429) {
    noteFallback('daily-limit');
  } else if (result.status === 403) {
    /*
      공급자가 계정을 막았습니다. **다시 눌러도 풀리지 않습니다.**
      이걸 「잠깐 끊김」으로 적어 두면 보호자 화면이 "한 번 들어 보세요"라고 안내하는데,
      며칠을 눌러 봐도 그대로라 앱이 고장 난 줄 알게 됩니다.

      이 세션에서는 더 시도하지 않습니다 — 어차피 안 되는 요청으로
      문제마다 한 번씩 기다리게 만들 이유가 없습니다.
    */
    serverUsable = false;
    noteFallback('blocked');
  } else {
    noteFallback('failed');
  }
  return false;
}

export const appSpeech: SpeechProvider = {
  isAvailable() {
    // 서버가 안 되면 브라우저 음성으로 넘어가므로, 둘 중 하나라도 되면 쓸 수 있습니다.
    return true;
  },

  async speak(text, rate, signal) {
    if (signal.aborted) return;
    if (await playFromServer(text, rate, 0, signal)) return;
    if (signal.aborted) return;

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
    if (await playFromServer(text, rate, gapMs, signal)) return;
    if (signal.aborted) return;

    for (const word of text.split(' ').filter(Boolean)) {
      if (signal.aborted) return;
      await browserSpeech.speak(word, rate, signal);
      if (signal.aborted) return;
      await new Promise((r) => window.setTimeout(r, gapMs));
    }
  },
};
