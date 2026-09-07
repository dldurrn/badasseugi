'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  buildSegments,
  joinLabel,
  nextAsk,
  prefixCells,
  type Segment,
} from '@/lib/choices';
import { sfx, initSfx } from '@/lib/sfx';
import { appSpeech, RATES, setActiveVoice } from '@/lib/tts-app';
import { saveSettings } from '@/lib/save-settings';
import type { Settings } from '@/lib/settings';
import {
  RATE_LABEL,
  SpeechController,
  STYLE_LABEL,
  type ReadingStyle,
  type SpeechRate,
} from '@/lib/tts';
import { growingGrid } from '@/lib/wongoji';
import { WongojiSheet } from './WongojiSheet';

/**
 * 골라서 익히기 — 듣고, 문장을 처음부터 끝까지 골라 만듭니다.
 *
 * **이 부품은 아무것도 저장하지 않습니다.** `saveSession` 도 `/api/sessions` 도 부르지 않습니다.
 * 점수·오답노트 별·이력 어느 것에도 닿지 않습니다 — 2지선다는 찍어서 절반이 맞는데,
 * 그게 절대 원칙 5가 막으려던 바로 그것이기 때문입니다.
 * 「안 부른다」가 아니라 **부를 코드가 여기 없다**는 것이 이 모드를 지키는 방식입니다.
 *
 * 그래서 나가기 확인 창도 없습니다(절대 원칙 2는 「기록」에 대한 규칙입니다).
 * 잃을 것이 없으니 붙잡을 까닭도 없습니다. 탭바도 그대로 둡니다.
 */
export function ChoiceBoard({
  items,
  title,
  listHref,
  settings,
}: {
  items: string[];
  title: string;
  listHref: string;
  settings: Settings;
}) {
  const [index, setIndex] = useState(0);
  const sentence = items[index] ?? '';

  /*
    후보 자리는 문장이 바뀔 때만 정합니다.
    그릴 때마다 새로 섞으면 아이가 읽는 중에 후보가 자리를 바꿉니다.
  */
  const segments: Segment[] = useMemo(() => buildSegments(sentence), [sentence]);

  const [at, setAt] = useState(() => nextAsk(segments, 0));
  const [wrong, setWrong] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState<ReadingStyle | null>(null);
  const [rate, setRate] = useState<SpeechRate>(settings.rate);
  const [done, setDone] = useState(false);

  const speech = useMemo(() => new SpeechController(appSpeech), []);
  const 흔들기 = useRef<number | null>(null);

  useEffect(() => initSfx(), []);
  useEffect(() => setActiveVoice(settings.voice), [settings.voice]);
  useEffect(() => () => speech.stop(), [speech]);
  useEffect(() => setAt(nextAsk(segments, 0)), [segments]);
  useEffect(
    () => () => {
      if (흔들기.current) window.clearTimeout(흔들기.current);
    },
    [],
  );

  const play = useCallback(
    async (style: ReadingStyle) => {
      if (!sentence) return;
      setSpeaking(style);
      await speech.play(sentence, rate, style);
      setSpeaking(null);
    },
    [sentence, rate, speech],
  );

  const 고른것 = segments.slice(0, at).map((s) => s.text).join('');
  const cells = prefixCells(고른것);
  const ask = segments[at]?.ask ?? null;

  /*
    지금 어절에서 이미 놓인 앞부분.

    조사를 가르면(학교 | 에) 낱말 후보가 「에 / 애」라는 낱글자가 됩니다.
    그러면 이 모드를 「빈 칸 채우기」가 아니라 「낱말 고르기」로 만든 까닭이 흐려집니다 —
    「에/애」만 떼어 보여 주면 왜 그런지 볼 자리가 없습니다.
    그래서 후보에 앞부분을 **옅게** 붙여 「학교에 / 학교애」로 견주게 합니다.
    앞부분은 이미 정해진 것이라 누르는 것과는 상관이 없습니다.
  */
  const 어절머리 =
    ask?.kind === 'word' ? 고른것.slice(고른것.lastIndexOf(' ') + 1) : '';
  const 문장완성 = at >= segments.length;
  const 마지막문장 = index === items.length - 1;

  const choose = (optionIndex: number) => {
    const seg = segments[at];
    if (!seg?.ask) return;

    if (seg.ask.options[optionIndex] !== seg.text) {
      // 틀린 것은 칸에 넣지 않습니다. 잠깐 짚고 지웁니다.
      sfx.wrong();
      setWrong(optionIndex);
      if (흔들기.current) window.clearTimeout(흔들기.current);
      흔들기.current = window.setTimeout(() => setWrong(null), 700);
      return;
    }

    /*
      맞았을 때는 소리를 내지 않습니다.
      한 문장에 아홉 번씩 누르는데 그때마다 축하 소리가 나면
      그건 안내가 아니라 잔소리이고, 보상은 시험을 끝까지 마쳤을 때만입니다(절대 원칙 1).
    */
    setWrong(null);
    setAt(nextAsk(segments, at + 1));
  };

  const 다음문장 = () => {
    speech.stop();
    if (마지막문장) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
  };

  if (items.length === 0) {
    return (
      <div className="page">
        <p className="surface p-6 text-center" style={{ color: 'var(--ink-soft)' }}>
          고를 것이 있는 문장이 없어요.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="page page--write">
        <div className="surface mt-12 flex flex-col items-center gap-3 p-7 text-center">
          <p className="display text-xl font-bold">다 익혔어요</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {items.length}문장을 모두 골랐어요.
            <br />
            점수는 남지 않아요. 진짜로 써 보고 싶으면 연습하기로 가요.
          </p>
          <div className="mt-2 flex w-full gap-2">
            <button
              className="btn btn-secondary flex-1 justify-center"
              onClick={() => {
                setDone(false);
                setIndex(0);
              }}
            >
              다시 하기
            </button>
            <Link href={listHref} className="btn btn-primary flex-1 justify-center">
              목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    /* 원고지 격자가 있는 화면이라 기둥을 넓힙니다 — 15칸의 폭이 곧 글자 크기입니다. */
    <div className="page page--write">
      <header className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <Link href={listHref} className="btn btn-quiet" aria-label="나가기">
            ←
          </Link>
          <h1 className="display flex-1 truncate text-lg font-bold">{title}</h1>
          {/* 시험·연습 태그와 같은 자리. 채점하지 않는 모드라 색은 조용한 쪽으로 둡니다. */}
          <span
            className="rounded px-2 py-1 text-[11px] font-bold"
            style={{ background: 'var(--paper-sunk)', color: 'var(--ink-soft)' }}
          >
            익히기
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: 'var(--paper-sunk)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${((index + 1) / items.length) * 100}%`,
                background: 'var(--grid)',
              }}
            />
          </div>
          <span className="text-xs tabular-nums" style={{ color: 'var(--ink-faint)' }}>
            {index + 1} / {items.length}
          </span>
        </div>
      </header>

      {/* 듣기 — 세션과 같은 자리, 같은 버튼 */}
      <section className="surface mb-4 flex flex-col items-center gap-3 p-5">
        <button
          onClick={() => play('flow')}
          disabled={speaking !== null}
          className="btn"
          style={{
            background: 'var(--grid)',
            color: '#fff',
            borderRadius: 999,
            padding: '15px 32px',
            fontSize: 18,
          }}
        >
          {speaking === 'flow' ? '읽는 중…' : '문장 듣기'}
        </button>

        <div className="flex flex-wrap justify-center gap-2">
          {(['chunked', 'teacher'] as const).map((style) => (
            <button
              key={style}
              onClick={() => play(style)}
              disabled={speaking !== null}
              className="btn btn-secondary"
              style={{ padding: '9px 14px', fontSize: 13.5, borderRadius: 999 }}
            >
              {speaking === style ? '읽는 중…' : STYLE_LABEL[style]}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5" role="group" aria-label="읽기 속도">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRate(r);
                // 세션과 같은 값을 씁니다. 여기서 고른 속도가 받아쓰기에도 이어집니다.
                void saveSettings('child', { rate: r });
              }}
              aria-pressed={rate === r}
              className="rounded-full px-3 py-1.5 text-xs transition-colors"
              style={{
                background: rate === r ? 'var(--grid)' : 'var(--paper-sunk)',
                color: rate === r ? '#fff' : 'var(--ink-soft)',
                fontWeight: rate === r ? 700 : 500,
              }}
            >
              {RATE_LABEL[r]}
            </button>
          ))}
        </div>
      </section>

      <p className="mb-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
        {문장완성 ? '다 골랐어요' : '들은 대로 골라 봐요'}
      </p>

      {/*
        고른 만큼만 채워집니다.
        커서를 늘 진하게 두는 이유는 여기가 「다음에 놓일 자리」이기 때문입니다 —
        쓰는 화면과 달리 포커스라는 것이 없습니다.
      */}
      <WongojiSheet
        cells={growingGrid(cells)}
        cursor={문장완성 ? undefined : cells.length}
        active
        fill
        label="고른 문장"
      />

      <div className="mt-4">
        {문장완성 ? (
          <button className="btn btn-primary btn-lg" onClick={다음문장}>
            {마지막문장 ? '끝내기' : '다음 문장'}
          </button>
        ) : ask ? (
          <div className="pick-bar" role="group" aria-label="후보">
            {ask.options.map((option, i) => (
              <button
                key={`${option}-${i}`}
                onClick={() => choose(i)}
                className={`pick${ask.kind === 'word' ? '' : ' pick--mark'}${
                  wrong === i ? ' pick--wrong' : ''
                }`}
              >
                {ask.kind === 'join' ? (
                  joinLabel(option)
                ) : (
                  <>
                    {어절머리 && <span className="pick-head">{어절머리}</span>}
                    {option}
                  </>
                )}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="mt-5 text-center text-xs leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
        점수는 남지 않아요. 그만두어도 괜찮아요.
      </p>
    </div>
  );
}
