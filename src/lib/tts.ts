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

/**
 * 아무것도 고르지 않았을 때 쓰는 목소리.
 *
 * 고전 계열(Neural2)이라 **같은 문장을 몇 번 불러도 똑같이 읽습니다.**
 * 받아쓰기는 "다시 듣기"가 매번 같아야 아이가 제 답을 견줄 수 있어서,
 * 자연스럽지만 부를 때마다 달라지는 최신 계열을 기본으로 두지 않습니다.
 *
 * 서버(합성할 때)와 화면(무엇을 쓰는 중인지 보여줄 때)이 같은 값을 봐야 하므로
 * 양쪽이 아니라 여기 한 곳에 둡니다.
 */
export const DEFAULT_VOICE = 'ko-KR-Neural2-A';

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
