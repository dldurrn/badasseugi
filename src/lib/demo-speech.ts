/**
 * 로그인 전 체험의 소리 — 미리 만든 파일을 틉니다(`demo.ts`).
 *
 * `appSpeech` 와 같은 자리(`SpeechProvider`)에 끼우므로 받아쓰기 화면은 무엇이 바뀌었는지 모릅니다.
 * 이어 읽기는 `-flow`, 또박또박은 `-chunked` 파일이고, 선생님처럼은 컨트롤러가 둘을 엮습니다.
 *
 * 파일이 없거나 안 열리면 **브라우저 음성으로 조용히** 넘어갑니다.
 * 체험하러 온 사람에게 「음성 오류」를 띄우면 거기서 닫습니다.
 */
import { normalize } from './hangul';
import { browserSpeech, GAP_BETWEEN_WORDS, type SpeechProvider } from './tts';
import { DEMO_SENTENCES, demoAudioPath, type DemoAudioKind } from './demo';

/** 체험 문장이면 그 파일 주소. 컨트롤러가 다듬은 문장이 넘어오므로 같은 방식으로 다듬어 견줍니다. */
export function demoAudioFor(text: string, kind: DemoAudioKind): string | null {
  const hit = DEMO_SENTENCES.find((d) => normalize(d.sentence) === normalize(text));
  return hit ? demoAudioPath(hit.id, kind) : null;
}

/** 끝까지 틀었으면(또는 중간에 멈췄으면) true, 못 틀었으면 false */
function playFile(url: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(true);
    const audio = new Audio(url);
    const finish = (ok: boolean) => {
      signal.removeEventListener('abort', onAbort);
      resolve(ok);
    };
    const onAbort = () => {
      audio.pause();
      finish(true);
    };
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    signal.addEventListener('abort', onAbort, { once: true });
    void audio.play().catch(() => finish(false));
  });
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      resolve();
    }, { once: true });
  });
}

export const demoSpeech: SpeechProvider = {
  isAvailable() {
    return true;
  },

  async speak(text, rate, signal) {
    const url = demoAudioFor(text, 'flow');
    if (url && (await playFile(url, signal))) return;
    if (signal.aborted) return;
    await browserSpeech.speak(text, rate, signal);
  },

  async speakWithPauses(text, rate, _gapMs, signal) {
    const url = demoAudioFor(text, 'chunked');
    if (url && (await playFile(url, signal))) return;
    // 브라우저 음성은 쉼을 못 넣어 낱말을 하나씩 읽습니다(`SpeechController` 와 같은 방식).
    for (const word of text.split(' ')) {
      if (signal.aborted) return;
      await browserSpeech.speak(word, rate, signal);
      await pause(GAP_BETWEEN_WORDS, signal);
    }
  },
};
