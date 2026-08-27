'use client';

import { useEffect, useMemo, useState } from 'react';
import { SpeechController } from '@/lib/tts';
import { appSpeech, setActiveVoice } from '@/lib/tts-app';
import { saveSettings } from '@/lib/save-settings';
import type { SpeechRate } from '@/lib/tts';

/**
 * 목소리 고르기.
 *
 * 화면은 **어느 회사 소리를 쓰는지 모릅니다.** 서버가 목록과 기본값을 주면 그리는 일만 합니다.
 * 서버가 이름까지 붙여 보내면(타입캐스트) 그대로 쓰고,
 * 이름 없이 식별자만 오면(Google) 아래 규칙으로 우리가 지어 붙입니다.
 *
 * ─────────────────────────────────────────────────────────────
 * 아래는 Google을 쓸 때의 이야기입니다.
 * 쓸 수 있는 한국어 목소리가 41개라 그중 **넷만 펼쳐 두고** 나머지는 접습니다.
 *
 * 한 번 뒤집힌 판단입니다
 * 처음에는 고전 계열(Neural2/Wavenet/Standard)을 앞에 세웠습니다.
 * 같은 문장을 몇 번 불러도 똑같이 읽으니 "다시 듣기"가 흔들리지 않는다는 이유였습니다.
 *
 * 그런데 실제로 들어 보니 **또렷하지 않았습니다.** 「송골」이 「쏭골」처럼 들려
 * 아이가 한 번 더 짚어 봐야 했습니다. 받아쓰기에서 안 들리면 나머지가 다 무의미합니다.
 *
 * 그리고 "매번 달라진다"는 걱정은 **캐시가 이미 막고 있었습니다**(tts-app.ts).
 * 한 세션은 화면 하나라 담아 둔 소리를 그대로 다시 틉니다.
 * 걱정하던 문제를 이미 풀어 놓고 그것 때문에 설계를 비틀고 있었습니다.
 *
 * 그래서 Chirp3 넷을 앞에 세우고 고전 계열은 아래로 내렸습니다.
 * 고전 계열도 지우지는 않습니다 — 완전히 일정한 소리가 필요한 경우가 있을 수 있습니다.
 *
 * Standard-A / Wavenet-A / Neural2-A 는 **같은 성우**이고 합성 품질만 다릅니다
 * (글자당 발화 시간이 정확히 같았습니다). 글자마다 가장 좋은 등급 하나만 세우고 나머지는 접습니다.
 *
 * 미리듣기는 글자 수로 과금되고 하루 한도(2만 자)를 아이와 나눠 씁니다.
 * 마흔 개를 다 들어 보면 그날 아이가 쓸 몫이 줄어듭니다 — 이것도 접는 이유입니다.
 *
 * 목록 자체는 코드에 적지 않고 서버에 물어봅니다. Google이 목소리를 계속 바꾸기 때문입니다.
 */

interface VoiceOption {
  name: string;
  /** 서버가 지어 준 이름. 타입캐스트처럼 이름 규칙이 없는 곳에서 씁니다 */
  label?: string;
  /** MALE / FEMALE / NEUTRAL */
  gender: string;
}

/**
 * 서버가 이름을 지어 보낸 경우 — 우리가 규칙을 만들 게 없습니다.
 *
 * 타입캐스트가 그렇습니다. 목소리에 언어 정보도, 성별도, 나이도 주지 않아서
 * 서버가 손으로 고른 목록을 이름까지 붙여 보냅니다.
 * 지금은 여자·남자 하나씩이라 나눌 묶음도 없습니다.
 */
function labelledGroups(voices: VoiceOption[]): Group[] {
  // 여자·남자 하나씩이라 묶음을 나눌 것이 없습니다. 한 줄로 세웁니다.
  return [
    {
      key: 'labelled',
      title: '',
      hint: '아이가 듣기 편한 쪽으로 골라 주세요',
      rows: voices.map((v) => ({ name: v.name, label: v.label ?? v.name })),
    },
  ].filter((g) => g.rows.length > 0);
}

const SAMPLE = '나는 학교에 갔어요.';

/** 고전 계열 이름 형태: ko-KR-Neural2-A 처럼 계열과 글자로 끝납니다. */
const CLASSIC = /^ko-KR-(Neural2|Wavenet|Standard)-([A-Z])$/;

/** 같은 성우면 이 순서로 좋은 등급을 고릅니다. */
const TIER: Record<string, number> = { Neural2: 3, Wavenet: 2, Standard: 1 };

/**
 * Chirp3 목소리의 성격.
 *
 * `Achernar`, `Kore` 같은 이름은 별과 위성 이름이라 그 자체로는 뜻이 없습니다.
 * 대신 Google이 목소리마다 성격을 공개해 두었고, 그게 고르는 데 실제로 도움이 됩니다.
 * 출처: Gemini 음성 목록 (ai.google.dev/gemini-api/docs/speech-generation)
 *
 * 주의: 성격표는 Gemini 문서에 있고 Cloud TTS 문서에는 없습니다.
 * 같은 이름을 쓰는 같은 목소리로 보이지만 Google이 못 박아 둔 것은 아닙니다.
 * 목록에 없는 이름이 생기면 원래 이름을 그대로 보여 줍니다.
 */
const CHIRP_TRAIT: Record<string, string> = {
  Achernar: '부드러운',
  Achird: '다정한',
  Algenib: '거친',
  Algieba: '매끄러운',
  Alnilam: '단단한',
  Aoede: '산뜻한',
  Autonoe: '밝은',
  Callirrhoe: '느긋한',
  Charon: '설명하는',
  Despina: '매끄러운',
  Enceladus: '숨소리 섞인',
  Erinome: '맑은',
  Fenrir: '신나는',
  Gacrux: '어른스러운',
  Iapetus: '맑은',
  Kore: '단단한',
  Laomedeia: '발랄한',
  Leda: '앳된',
  Orus: '단단한',
  Puck: '발랄한',
  Pulcherrima: '또렷한',
  Rasalgethi: '설명하는',
  Sadachbia: '활기찬',
  Sadaltager: '박식한',
  Schedar: '고른',
  Sulafat: '따뜻한',
  Umbriel: '느긋한',
  Vindemiatrix: '순한',
  Zephyr: '밝은',
  Zubenelgenubi: '편안한',
};

/** 성격이 겹치는 목소리가 있어(밝은 = Autonoe·Zephyr) 같은 묶음 안에서는 번호를 붙입니다. */
function numberDuplicates(rows: VoiceRow[]): VoiceRow[] {
  const total = new Map<string, number>();
  for (const r of rows) total.set(r.label, (total.get(r.label) ?? 0) + 1);

  const seen = new Map<string, number>();
  return rows.map((r) => {
    if ((total.get(r.label) ?? 0) < 2) return r;
    const n = (seen.get(r.label) ?? 0) + 1;
    seen.set(r.label, n);
    return { ...r, label: `${r.label} ${n}` };
  });
}

interface VoiceRow {
  name: string;
  /** 화면에 보일 한글 이름 */
  label: string;
}

interface Group {
  key: string;
  title: string;
  hint?: string;
  rows: VoiceRow[];
  /** 접어 둘 묶음인지 */
  folded?: boolean;
}

/**
 * 앞에 세우는 목소리 넷.
 *
 * 한국어 Chirp3 서른 개를 같은 문장으로 세 번씩 합성해 길이의 흔들림을 재고,
 * Google이 공개한 성격표에서 또렷함과 어울리는 것을 골랐습니다.
 *
 *   Gacrux    흔들림 0.12초  — 가장 안정적이고 짧은 낱말을 느긋하게 읽습니다
 *   Sulafat   흔들림 0.20초
 *   Alnilam   흔들림 0.32초
 *   Orus      흔들림 0.44초
 *
 * 흔들림이 큰 목소리(0.6~1.7초)는 속도 버튼을 눌러도 효과가 거기 묻혀 버립니다.
 * 실제로 Leda는 「천천히」가 83%로 죽어 있었고, Gacrux는 99%로 살아 있습니다.
 */
const RECOMMENDED = [
  { star: 'Gacrux', label: '여자 1 · 어른스러운' },
  { star: 'Sulafat', label: '여자 2 · 따뜻한' },
  { star: 'Alnilam', label: '남자 1 · 단단한' },
  { star: 'Orus', label: '남자 2 · 또렷한' },
] as const;

/**
 * 목소리 이름을 사람이 읽을 수 있게 바꿉니다.
 *
 * `ko-KR-Neural2-A`는 아무것도 알려 주지 않습니다.
 * 성별과 순번으로 부르면 부모가 넷을 다 들어 보고 고를 수 있습니다.
 * 낮은 품질 묶음도 같은 번호를 쓰므로, 같은 번호면 같은 성우입니다.
 */
function labelByLetter(voices: VoiceOption[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const [pick, word] of [
    [(v: VoiceOption) => v.gender === 'FEMALE', '여자'],
    [(v: VoiceOption) => v.gender === 'MALE', '남자'],
  ] as const) {
    voices
      .filter(pick)
      .map((v) => v.name.match(CLASSIC)?.[2] ?? '')
      .filter(Boolean)
      .sort()
      .forEach((letter, i) => map.set(letter, `또박또박 ${word} ${i + 1}`));
  }
  return map;
}

function buildGroups(voices: VoiceOption[], defaultVoice: string | null): Group[] {
  // 서버가 이름을 붙여 보냈으면 그대로 씁니다. 우리가 규칙을 만들 게 없습니다.
  if (voices.some((v) => v.label)) return labelledGroups(voices);

  // 글자(A/B/C/D)마다 가장 좋은 등급 하나만 남깁니다.
  // Neural2에 D가 없으므로 Wavenet-D가 D의 대표가 되는 식입니다.
  const bestOfLetter = new Map<string, { name: string; tier: number }>();
  for (const v of voices) {
    const m = v.name.match(CLASSIC);
    if (!m) continue;
    const tier = TIER[m[1]] ?? 0;
    const prev = bestOfLetter.get(m[2]);
    if (!prev || tier > prev.tier) bestOfLetter.set(m[2], { name: v.name, tier });
  }
  const bestNames = new Set([...bestOfLetter.values()].map((b) => b.name));

  const isClassic = (v: VoiceOption) => CLASSIC.test(v.name);
  const isChirp = (v: VoiceOption) => v.name.includes('Chirp3');
  const female = (v: VoiceOption) => v.gender === 'FEMALE';
  const male = (v: VoiceOption) => v.gender === 'MALE';

  const steady = voices.filter((v) => isClassic(v) && bestNames.has(v.name));
  const duplicates = voices.filter((v) => isClassic(v) && !bestNames.has(v.name));

  const nameOf = labelByLetter(steady);
  const classicLabel = (name: string): string =>
    nameOf.get(name.match(CLASSIC)?.[2] ?? '') ?? name.replace('ko-KR-', '');

  /** Chirp3는 별 이름 대신 Google이 공개한 성격으로 부릅니다. */
  const chirpRows = (pick: (v: VoiceOption) => boolean): VoiceRow[] =>
    numberDuplicates(
      voices
        .filter((v) => isChirp(v) && pick(v))
        .map((v) => {
          const star = v.name.replace('ko-KR-Chirp3-HD-', '');
          const trait = CHIRP_TRAIT[star];
          return { name: v.name, label: trait ? `${trait} 목소리` : star };
        }),
    );

  /*
    권하는 넷만 펼쳐 둡니다.

    한국어 Chirp3 서른 개를 문장 하나로 세 번씩 합성해서, 길이가 얼마나 흔들리는지 쟀습니다.
    흔들림이 큰 목소리는 속도 버튼을 눌러도 그 효과가 흔들림에 묻혀 버립니다.
    아래 넷은 흔들림이 작으면서 성격도 또렷한 쪽이라, 속도와 어절 쉼이 제대로 먹습니다.

    고전 계열(Neural2 등)은 아래로 내렸습니다. 완전히 일정한 대신 흐리게 들립니다.
    받아쓰기는 안 들리면 나머지가 다 무의미해서, 또렷함을 앞에 둡니다.
  */
  const recommendedRows = RECOMMENDED.map((r) => ({
    name: `ko-KR-Chirp3-HD-${r.star}`,
    label: r.label,
  })).filter((r) => voices.some((v) => v.name === r.name));

  const isRecommended = (v: VoiceOption) => recommendedRows.some((r) => r.name === v.name);

  return [
    {
      key: 'best',
      title: '받아쓰기에 알맞은 목소리',
      hint: '또렷하게 읽고, 속도와 또박또박 듣기가 잘 들어요',
      rows: recommendedRows,
    },
    {
      key: 'chirp-f',
      title: '다른 목소리 · 여자',
      rows: chirpRows((v) => female(v) && !isRecommended(v)),
      folded: true,
    },
    {
      key: 'chirp-m',
      title: '다른 목소리 · 남자',
      rows: chirpRows((v) => male(v) && !isRecommended(v)),
      folded: true,
    },
    {
      key: 'steady',
      title: '옛 방식 목소리',
      hint: '몇 번을 불러도 완전히 같은 소리예요. 대신 조금 흐리게 들릴 수 있어요',
      rows: [...steady].map((v) => ({ name: v.name, label: classicLabel(v.name) })),
      folded: true,
    },
    {
      key: 'dup',
      title: '같은 목소리의 낮은 품질',
      hint: '위와 같은 번호면 같은 성우예요. 굳이 고를 이유는 없어요',
      rows: duplicates.map((v) => ({ name: v.name, label: classicLabel(v.name) })),
      folded: true,
    },
  ].filter((g) => g.rows.length > 0);
}

export function VoiceSettings({
  scope,
  value,
  rate,
}: {
  /** 부모가 기본값을 정하는가, 아이가 자기 것을 고르는가 */
  scope: 'family' | 'child';
  /** 지금 이 층에 저장된 값. 안 골랐으면 null — 그때는 서버 기본값을 켜서 보여 줍니다. */
  value: string | null;
  /** 미리듣기에 쓸 속도 */
  rate: SpeechRate;
}) {
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  /** 방금 눌러서 바꾼 값. 아직 안 눌렀으면 null이고 그때는 props를 씁니다. */
  const [picked, setPicked] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [openFolded, setOpenFolded] = useState(false);
  /** 서버가 알려 준 기본 목소리. 어느 회사인지에 따라 달라집니다 */
  const [defaultVoice, setDefaultVoice] = useState<string | null>(null);

  useEffect(() => {
    // 목록과 기본값은 서버가 정합니다. 화면은 어느 회사인지 몰라도 됩니다.
    fetch('/api/tts/voices')
      .then((r) => (r.ok ? r.json() : { voices: [] }))
      .then((payload: { voices?: VoiceOption[]; defaultVoice?: string | null }) => {
        setVoices(payload.voices ?? []);
        setDefaultVoice(payload.defaultVoice ?? null);
      })
      .catch(() => setVoices([]));
  }, []);

  const groups = useMemo(
    () => (voices ? buildGroups(voices, defaultVoice) : []),
    [voices, defaultVoice],
  );
  const foldedCount = groups.filter((g) => g.folded).reduce((n, g) => n + g.rows.length, 0);

  /*
    **켜진 것은 상태가 아니라 계산입니다.**

    예전에는 useEffect 로 props를 상태에 옮겨 담았습니다.
    그러다 공급자가 바뀌어 저장된 이름(`tc_…`)이 지금 목록(`ko-KR-…`)에 없게 되자,
    그 이름이 그대로 「켜진 것」에 앉아 **아무 줄과도 안 맞았습니다** —
    동그라미 두 개가 다 빈 화면이 나왔습니다.
    부모는 "골라 둔 게 사라졌나" 하고, 지금 뭘로 읽는지도 알 수 없습니다.

    이제 매번 계산합니다. 그리고 **목록에 있는 것만** 켭니다.
      방금 누른 것 → 저장된 것 → 서버 기본값 → 목록 첫 줄
    마지막 갈래가 있어 목록이 비어 있지 않은 한 **언제나 하나는 켜집니다.**
  */
  const 있는것 = (name: string | null | undefined) =>
    name && voices?.some((v) => v.name === name) ? name : null;

  const selected =
    있는것(picked) ?? 있는것(value) ?? 있는것(defaultVoice) ?? voices?.[0]?.name ?? null;

  // 접힌 묶음 안의 목소리를 쓰고 있으면 펼쳐 둡니다. 자기가 고른 게 안 보이면 안 됩니다.
  useEffect(() => {
    if (!selected) return;
    const folded = groups.find((g) => g.folded);
    if (folded?.rows.some((r) => r.name === selected)) setOpenFolded(true);
  }, [selected, groups]);

  if (!voices || voices.length === 0) return null;

  const choose = async (name: string) => {
    setPicked(name);
    // 담아 둔 소리는 옛 목소리라 버리고, 이 화면의 미리듣기도 새 목소리로 납니다.
    setActiveVoice(name);
    // 기다리지 않습니다 — 눌린 느낌이 먼저입니다.
    void saveSettings(scope, { voice: name });

    // 고르자마자 들려줍니다. 이름만 보고는 고를 수 없습니다.
    setPlaying(name);
    const speech = new SpeechController(appSpeech);
    await speech.play(SAMPLE, rate, 'flow');
    setPlaying(null);
  };

  return (
    <>
      <h2 className="section-title mb-2">목소리</h2>

      {/*
        접힌 묶음을 한 번에 펼칩니다.
        묶음마다 "펼쳐 보기"를 두면 버튼만 셋이 되어 오히려 복잡해집니다.
      */}
      {!openFolded && foldedCount > 0 && (
        <button
          className="btn btn-quiet mb-6 w-full justify-center text-sm"
          onClick={() => setOpenFolded(true)}
        >
          다른 목소리 더 보기 ({foldedCount}개)
        </button>
      )}

      {groups.map((group) => {
        const hidden = group.folded && !openFolded;
        if (hidden) return null;
        return (
          <div key={group.key} className="mb-4">
            {/* 묶음이 하나뿐이면 위의 「목소리」 제목과 겹치므로 이름을 안 답니다 */}
            {group.title && (
              <div className="mb-1.5 flex items-baseline gap-2 px-1">
                <span className="text-[13px] font-bold">{group.title}</span>
                <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                  {group.rows.length}개
                </span>
              </div>
            )}
            {group.hint && (
              <p className="mb-1.5 px-1 text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>
                {group.hint}
              </p>
            )}

            <ul className="surface flex flex-col divide-y" style={{ borderColor: 'var(--rule)' }}>
                {group.rows.map((row) => {
                  const on = row.name === selected;
                  return (
                    <li key={row.name}>
                      <button
                        onClick={() => choose(row.name)}
                        className="flex w-full items-center gap-3 p-4 text-left"
                        aria-pressed={on}
                      >
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                          style={{
                            border: `2px solid ${on ? 'var(--grid)' : 'var(--rule-strong)'}`,
                            background: on ? 'var(--grid)' : 'transparent',
                          }}
                          aria-hidden="true"
                        >
                          {on && <span className="text-[11px] text-white">✓</span>}
                        </span>
                        <span className="flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[15px] font-semibold">{row.label}</span>
                            {row.name === defaultVoice && (
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                                style={{ background: 'var(--grid-tint)', color: 'var(--grid-deep)' }}
                              >
                                기본
                              </span>
                            )}
                          </span>
                          {/* 어느 목소리인지 서로 이야기할 일이 있어 원래 이름도 작게 남깁니다. */}
                          <span
                            className="block text-[10.5px]"
                            style={{ color: 'var(--ink-faint)' }}
                          >
                            {row.name.replace('ko-KR-', '')}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs" style={{ color: 'var(--ink-faint)' }}>
                          {playing === row.name ? '들려주는 중…' : '눌러서 듣기'}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        );
      })}

      <div className="mb-6" />
    </>
  );
}
