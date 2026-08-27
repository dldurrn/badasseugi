/**
 * 문장 읽어주기 (TTS)
 *
 * 공급자를 나중에 바꿀 수 있도록 인터페이스를 분리했습니다.
 * 지금은 브라우저 내장 음성(SpeechSynthesis)을 쓰고,
 * 클로바 보이스 등으로 교체할 때는 SpeechProvider만 새로 구현하면 됩니다.
 * 화면 코드는 손대지 않아도 됩니다.
 *
 * 읽기 방식이 세 가지인 이유
 * - 이어 읽기: 실제 시험처럼 자연스럽게. 기본값.
 * - 끊어 읽기: 어절마다 쉬어서 띄어쓰기 위치를 귀로 알 수 있게. 헷갈릴 때만 쓰도록 보조 버튼.
 * - 선생님처럼: 전체 → 끊어서 → 전체. 실제 받아쓰기 시험의 진행 방식.
 */

import { normalize } from './hangul';

export type SpeechRate = 0.65 | 0.85 | 1.0;
/** 화면에서 고를 수 있는 속도. 이 세 가지 말고는 저장하지 않습니다. */
export const RATES: readonly SpeechRate[] = [0.65, 0.85, 1.0];

/**
 * 기본 속도는 「보통」입니다.
 *
 * 예전에는 0.85(천천히)였습니다. 저학년이니 천천히가 낫겠다는 짐작이었는데,
 * 실제로 들어 보니 **늦출수록 오히려 안 들렸습니다.**
 * TTS는 속도를 낮추면 소리를 늘려 재생하는데, 마찰음(ㅅ)이 길어지면
 * 귀는 그걸 된소리(ㅆ)로 듣습니다 — 「송골」이 「쏭골」로 들리던 게 이것이었습니다.
 *
 * 천천히가 필요한 아이는 받아쓰기 화면에서 그때 누르면 됩니다.
 */
export const DEFAULT_RATE: SpeechRate = 1.0;

/**
 * 아무것도 고르지 않았을 때 쓰는 목소리.
 *
 * 예전에는 Neural2-A였습니다. "매번 똑같이 읽는다"는 이유였는데, 두 가지가 틀렸습니다.
 *
 * 하나 — **또렷하지 않았습니다.** 실제로 들어 보니 「송골」이 「쏭골」처럼 들려
 * 아이가 한 번 더 짚어 봐야 했습니다. 받아쓰기에서 이건 치명적입니다.
 *
 * 둘 — 매번 달라진다는 걱정은 **캐시가 이미 막고 있었습니다.**
 * 한 세션은 화면 하나라 담아 둔 소리를 그대로 다시 틉니다.
 * "다시 듣기"는 그 자리에서 언제나 같은 소리입니다.
 *
 * Gacrux를 고른 근거 (한국어 Chirp3 30개를 재서 골랐습니다)
 * - 흔들림 0.12초로 Chirp3 중 가장 작습니다 (다른 목소리는 0.6~1.7초).
 * - **속도 조절이 먹습니다** (99%). Leda 같은 목소리는 흔들림에 묻혀 안 먹었습니다.
 * - 어절 쉼도 반영됩니다 (1.04초 요청에 +1.32초).
 * - 짧은 낱말을 느긋하게 읽습니다 (「포도」가 Neural2의 두 배 길이).
 *   낱말 하나짜리 문항이 아이가 가장 헤매는 자리라 이게 도움이 됩니다.
 *
 * 서버(합성할 때)와 화면(무엇을 쓰는 중인지 보여줄 때)이 같은 값을 봐야 하므로
 * 양쪽이 아니라 여기 한 곳에 둡니다.
 */
export const DEFAULT_VOICE = 'ko-KR-Chirp3-HD-Gacrux';

export const RATE_LABEL: Record<SpeechRate, string> = {
  0.65: '아주 천천히',
  0.85: '천천히',
  1.0: '보통',
};

export interface SpeechProvider {
  /** 한 문장을 끝까지 읽습니다. 중단되면 조용히 종료합니다. */
  speak(text: string, rate: number, signal: AbortSignal): Promise<void>;
  /** 이 기기에서 쓸 수 있는지 */
  isAvailable(): boolean;
  /**
   * 어절 사이를 벌리되 **한 문장으로** 읽습니다.
   *
   * 없어도 됩니다 — 그러면 컨트롤러가 낱말을 하나씩 따로 읽습니다.
   * 다만 낱말 하나만 던지면 TTS가 그걸 완결된 문장으로 읽어 뚝뚝 끊깁니다.
   * 이걸 구현할 수 있는 공급자는 문장 억양을 살린 채로 사이만 벌릴 수 있습니다.
   */
  speakWithPauses?(
    text: string,
    rate: number,
    gapMs: number,
    signal: AbortSignal,
  ): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* 브라우저 내장 음성                                                  */
/* ------------------------------------------------------------------ */

/** 한국어 음성 중 자연스러운 것을 우선 고릅니다. */
function pickKoreanVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const korean = voices.filter((v) => v.lang?.toLowerCase().startsWith('ko'));
  if (korean.length === 0) return null;

  // 경험상 품질 순서. 기기에 있는 것 중 가장 앞선 것을 씁니다.
  const preferred = ['Google', 'Yuna', 'Heami', 'Microsoft', 'Siri'];
  for (const name of preferred) {
    const found = korean.find((v) => v.name.includes(name));
    if (found) return found;
  }
  return korean[0];
}

export const browserSpeech: SpeechProvider = {
  isAvailable() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },

  speak(text, rate, signal) {
    return new Promise<void>((resolve) => {
      if (!this.isAvailable() || signal.aborted) return resolve();

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ko-KR';
      utter.rate = rate;
      const voice = pickKoreanVoice();
      if (voice) utter.voice = voice;

      const done = () => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      };
      const onAbort = () => {
        window.speechSynthesis.cancel();
        done();
      };

      utter.onend = done;
      utter.onerror = done;
      signal.addEventListener('abort', onAbort, { once: true });

      window.speechSynthesis.speak(utter);
    });
  },
};

/* ------------------------------------------------------------------ */
/* 재생 제어                                                           */
/* ------------------------------------------------------------------ */

export type ReadingStyle = 'flow' | 'chunked' | 'teacher';

export const STYLE_LABEL: Record<ReadingStyle, string> = {
  flow: '문장 듣기',
  chunked: '또박또박 듣기',
  teacher: '선생님처럼 듣기',
};

const GAP_BETWEEN_WORDS = 520; // ms — 띄어쓰기를 귀로 알아챌 만한 간격
const GAP_BETWEEN_PASSES = 850;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const id = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * 재생을 관리하는 컨트롤러.
 * 새 재생을 시작하면 이전 재생은 즉시 중단됩니다.
 */
export class SpeechController {
  private controller: AbortController | null = null;

  constructor(private provider: SpeechProvider = browserSpeech) {}

  get available(): boolean {
    return this.provider.isAvailable();
  }

  stop(): void {
    this.controller?.abort();
    this.controller = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  async play(text: string, rate: SpeechRate, style: ReadingStyle): Promise<void> {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    const { signal } = controller;
    const sentence = normalize(text);
    if (!sentence) return;

    const speakWhole = () => this.provider.speak(sentence, rate, signal);

    const speakChunks = async () => {
      // 한 문장으로 읽을 수 있으면 그쪽이 훨씬 잘 들립니다.
      // 낱말을 따로 합성하면 TTS가 낱말마다 문장을 끝내듯 읽어서,
      // 또박또박 들으려고 누른 것이 오히려 더 안 들립니다.
      if (this.provider.speakWithPauses) {
        await this.provider.speakWithPauses(sentence, rate, GAP_BETWEEN_WORDS, signal);
        return;
      }

      // 브라우저 내장 음성은 쉼을 지정할 수 없어 낱말을 하나씩 읽습니다.
      for (const word of sentence.split(' ')) {
        if (signal.aborted) return;
        await this.provider.speak(word, rate, signal);
        if (signal.aborted) return;
        await wait(GAP_BETWEEN_WORDS, signal);
      }
    };

    switch (style) {
      case 'flow':
        await speakWhole();
        break;

      case 'chunked':
        await speakChunks();
        break;

      case 'teacher':
        await speakWhole();
        if (signal.aborted) return;
        await wait(GAP_BETWEEN_PASSES, signal);
        await speakChunks();
        if (signal.aborted) return;
        await wait(GAP_BETWEEN_PASSES, signal);
        await speakWhole();
        break;
    }
  }
}
