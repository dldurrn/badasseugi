'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_VOICE, SpeechController } from '@/lib/tts';
import { appSpeech, readRate, readVoice, writeVoice } from '@/lib/tts-app';

/**
 * 목소리 고르기.
 *
 * 쓸 수 있는 한국어 목소리가 41개입니다. 그중 **넷만 펼쳐 두고** 나머지는 접습니다.
 *
 * 왜 넷인가
 * 계열에 따라 성격이 뚜렷하게 갈립니다.
 * - 고전 계열(Neural2/Wavenet/Standard)은 같은 문장을 몇 번을 불러도 **똑같이** 읽습니다.
 * - Chirp3 계열은 생성형이라 부를 때마다 길이와 억양이 조금씩 **달라집니다**.
 *
 * 받아쓰기는 "다시 듣기"가 매번 같아야 아이가 제 답을 견줄 수 있습니다.
 * 그래서 고전 계열만 권하는데, 그게 넷입니다(여자 둘·남자 둘).
 *
 * 예전에는 서른셋을 늘어놓았습니다. 그중 스물아홉이 우리가 권하지 않는 최신 계열이었고,
 * 화면에 경고까지 붙여 두었습니다 — **권하지 않는 것이 목록의 아홉 할**이었던 셈입니다.
 * 지우지는 않습니다. 아이가 좋아하는 목소리가 있을 수 있고, 연습 모드라면 매번 달라도 됩니다.
 *
 * Standard-A / Wavenet-A / Neural2-A 는 **같은 성우**이고 합성 품질만 다릅니다
 * (글자당 발화 시간이 정확히 같았습니다). 글자마다 가장 좋은 등급 하나만 세우고 나머지는 접습니다.
 *
 * 미리듣기는 글자 수로 과금되고 하루 한도(2만 자)를 아이와 나눠 씁니다.
 * 서른셋을 다 들어 보면 그날 아이가 쓸 몫이 줄어듭니다 — 이것도 접는 이유입니다.
 *
 * 목록 자체는 코드에 적지 않고 서버에 물어봅니다. Google이 목소리를 계속 바꾸기 때문입니다.
 */

interface VoiceOption {
  name: string;
  /** MALE / FEMALE / NEUTRAL */
  gender: string;
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

function buildGroups(voices: VoiceOption[]): Group[] {
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

    예전에는 서른세 개를 늘어놓았는데, 그중 스물아홉이 최신 계열이었습니다.
    최신 계열은 부를 때마다 조금씩 다르게 읽어서 **받아쓰기에는 맞지 않습니다** —
    아이가 "다시 듣기"를 눌렀을 때 아까와 다른 소리가 나면 제 답을 견줄 수가 없습니다.
    우리가 권하지 않는 것이 목록의 아홉 할을 차지하고 있었던 셈입니다.

    지우지는 않습니다. 아이가 특정 목소리를 좋아할 수 있고,
    연습 모드라면 매번 달라도 크게 문제되지 않습니다.

    미리듣기가 글자 수로 과금되고 하루 한도(2만 자)를 아이와 나눠 쓴다는 점도 있습니다.
    서른세 개를 다 들어 보면 그날 아이가 쓸 몫이 줄어듭니다.
  */
  const steadyRows = [...steady]
    .map((v) => ({ name: v.name, label: classicLabel(v.name) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));

  // 기본 목소리를 맨 앞에 둡니다. 고르지 않았을 때 실제로 나는 소리입니다.
  const at = steadyRows.findIndex((r) => r.name === DEFAULT_VOICE);
  if (at > 0) steadyRows.unshift(...steadyRows.splice(at, 1));

  return [
    {
      key: 'steady',
      title: '받아쓰기에 알맞은 목소리',
      hint: '몇 번을 들어도 똑같이 읽어요',
      rows: steadyRows,
    },
    {
      key: 'chirp-f',
      title: '자연스러운 목소리 · 여자',
      hint: '사람에 더 가깝지만 부를 때마다 조금씩 다르게 읽어요. 받아쓰기에는 위쪽을 권해요',
      rows: chirpRows(female),
      folded: true,
    },
    {
      key: 'chirp-m',
      title: '자연스러운 목소리 · 남자',
      rows: chirpRows(male),
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

export function VoiceSettings() {
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [openFolded, setOpenFolded] = useState(false);

  useEffect(() => {
    // 고른 적이 없으면 기본 목소리가 선택된 것으로 보여 줍니다.
    // 아무것도 안 켜져 있으면 "그럼 지금 뭘로 읽고 있지?"가 됩니다.
    // 저장은 하지 않습니다 — 나중에 기본이 바뀌면 따라가야 하니까요.
    setSelected(readVoice() ?? DEFAULT_VOICE);
    fetch('/api/tts/voices')
      .then((r) => (r.ok ? r.json() : { voices: [] }))
      .then((payload: { voices?: VoiceOption[] }) => setVoices(payload.voices ?? []))
      .catch(() => setVoices([]));
  }, []);

  const groups = useMemo(() => (voices ? buildGroups(voices) : []), [voices]);
  const foldedCount = groups.filter((g) => g.folded).reduce((n, g) => n + g.rows.length, 0);

  // 접힌 묶음 안의 목소리를 쓰고 있으면 펼쳐 둡니다. 자기가 고른 게 안 보이면 안 됩니다.
  useEffect(() => {
    if (!selected) return;
    const folded = groups.find((g) => g.folded);
    if (folded?.rows.some((r) => r.name === selected)) setOpenFolded(true);
  }, [selected, groups]);

  if (!voices || voices.length === 0) return null;

  const choose = async (name: string) => {
    writeVoice(name);
    setSelected(name);

    // 고르자마자 들려줍니다. 이름만 보고는 고를 수 없습니다.
    setPlaying(name);
    const speech = new SpeechController(appSpeech);
    await speech.play(SAMPLE, readRate(), 'flow');
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
            <div className="mb-1.5 flex items-baseline gap-2 px-1">
              <span className="text-[13px] font-bold">{group.title}</span>
              <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                {group.rows.length}개
              </span>
            </div>
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
                            {row.name === DEFAULT_VOICE && (
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
