/**
 * 효과음
 *
 * 음원 파일 없이 Web Audio로 생성합니다. 로딩이 없고 용량도 들지 않습니다.
 *
 * 설계 방향
 * - 짧고 부드럽게. 아이가 하루에 수십 번 듣는 소리라 자극적이면 금방 피로해집니다.
 * - 오답은 벌 주는 소리가 아니라 "여기 보자"는 신호 정도로만. 낮고 짧은 단음.
 * - 정답은 두 음이 위로 이어지는 짧은 상승. 축하가 아니라 확인의 느낌.
 * - 보상은 세트를 끝까지 마쳤을 때만 울리는 유일한 화음입니다.
 */

let ctx: AudioContext | null = null;
let muted = false;

const MUTE_KEY = 'badasseugi:muted';

/** 저장된 음소거 설정을 불러옵니다. 앱 시작 시 한 번 호출하세요. */
export function initSfx(): void {
  if (typeof window === 'undefined') return;
  muted = window.localStorage.getItem(MUTE_KEY) === '1';
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || muted) return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    // 브라우저 자동재생 정책상 사용자 조작 이후에만 재개됩니다.
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOptions {
  freq: number;
  start: number;
  duration: number;
  peak: number;
  type?: OscillatorType;
}

function tone(c: AudioContext, { freq, start, duration, peak, type = 'sine' }: ToneOptions): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  // 부드러운 감쇠를 위한 저역 통과 — 날카로운 배음을 깎아냅니다.
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2600;

  osc.type = type;
  osc.frequency.value = freq;

  const t = c.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.04);
}

export const sfx = {
  /** 정답 — 두 음이 위로 이어지는 짧은 확인음 */
  correct(): void {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 587.33, start: 0, duration: 0.1, peak: 0.1 }); // D5
    tone(c, { freq: 880.0, start: 0.085, duration: 0.16, peak: 0.085 }); // A5
  },

  /** 오답 — 낮고 짧은 단음. 벌주는 소리가 아니라 주의를 옮기는 신호 */
  wrong(): void {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 233.08, start: 0, duration: 0.18, peak: 0.075 }); // B♭3
  },

  /** 별 획득 — 오답노트에서 별 하나를 모았을 때 */
  star(): void {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 1046.5, start: 0, duration: 0.14, peak: 0.075, type: 'triangle' });
    tone(c, { freq: 1318.5, start: 0.09, duration: 0.2, peak: 0.06, type: 'triangle' });
  },

  /** 보상 — 시험을 끝까지 마치고 배지·카드를 받은 순간에만 */
  reward(): void {
    const c = audio();
    if (!c) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C-E-G-C
    notes.forEach((f, i) => {
      tone(c, { freq: f, start: i * 0.1, duration: 0.3, peak: 0.09, type: 'triangle' });
    });
  },

  /** 화면 전환 등 아주 가벼운 확인음 */
  tick(): void {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 660, start: 0, duration: 0.05, peak: 0.04 });
  },
};
