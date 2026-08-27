'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { grade, scoreOf, type GradeResult } from '@/lib/grading';
import {
  RATE_LABEL,
  SpeechController,
  STYLE_LABEL,
  type ReadingStyle,
  type SpeechRate,
} from '@/lib/tts';
import { sfx } from '@/lib/sfx';
import { appSpeech, RATES, setActiveVoice } from '@/lib/tts-app';
import { saveSettings } from '@/lib/save-settings';
import type { Settings } from '@/lib/settings';
import { LEAVE_MESSAGE, useLeaveGuard } from '@/lib/use-leave-guard';
import { SENTENCE_MAX } from '@/lib/sets';
import { padToGrid, toCells, writingToText } from '@/lib/wongoji';

import { GradeSheet } from './GradeSheet';
import { NextButton } from './NextButton';
import { WongojiInput } from './WongojiInput';
import { WongojiSheet } from './WongojiSheet';
import type { Mode } from '@/lib/types';

/**
 * 받아쓰기 한 세션.
 *
 * 지켜야 하는 규칙 (CLAUDE.md 절대 원칙)
 * - 제출 전 최종 확인 단계를 반드시 거친다.
 * - 세션을 끝까지 마쳤을 때만 onComplete를 호출한다. 중도 이탈 시 호출하지 않는다.
 * - 입력창의 브라우저 맞춤법 교정을 끈다. 켜져 있으면 정답을 미리 알려주는 셈이다.
 * - 연습 모드는 틀린 즉시 설명을 보여주고, 시험 모드는 끝까지 푼 뒤 결과를 낸다.
 */

export interface SessionItem {
  /** 오답노트 참조용 식별자 — 받아쓰기는 문장 원문 */
  refId: string;
  sentence: string;
}

export interface SessionOutcome {
  refId: string;
  content: string;
  correct: boolean;
  errorTypes: string[];
}

type Phase = 'writing' | 'confirming' | 'reviewing';

export function DictationSession({
  items,
  mode,
  title,
  starNoteFor,
  onComplete,
  onExit,
  settings,
}: {
  items: SessionItem[];
  mode: Mode;
  title: string;
  /** 오답 연습 중 별 안내 문구를 만들어 주는 함수 (선택) */
  starNoteFor?: (refId: string, correct: boolean) => string | null;
  /** 세션을 끝까지 마쳤을 때만 호출됩니다. */
  onComplete: (outcomes: SessionOutcome[], score: number) => void;
  onExit: () => void;
  /** 서버가 읽어 내려준 값 — 이 아이 것 → 부모 기본값 → 앱 기본값 */
  settings: Settings;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('writing');
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [outcomes, setOutcomes] = useState<SessionOutcome[]>([]);
  // 서버에서 그릴 때는 localStorage를 읽을 수 없어 기본값으로 두고, 뜬 뒤에 저장된 값을 불러옵니다.
  const [rate, setRate] = useState<SpeechRate>(settings.rate);
  const [speaking, setSpeaking] = useState<ReadingStyle | null>(null);
  const writeMode = settings.writeMode;

  const inputRef = useRef<HTMLInputElement>(null);
  // 서버 음성을 먼저 쓰고 안 되면 브라우저 음성으로 넘어갑니다.
  // 서버가 어느 회사를 쓰는지는 여기서 알 필요가 없습니다(lib/tts-engines.ts).
  const speech = useMemo(() => new SpeechController(appSpeech), []);
  const completedRef = useRef(false);

  const current = items[index];
  const isLast = index === items.length - 1;

  // 한 글자라도 쓰기 시작했으면 그때부터 나가기를 붙잡습니다.
  const started = outcomes.length > 0 || typed.trim().length > 0;
  useLeaveGuard(started && !completedRef.current, LEAVE_MESSAGE);

  // 소리를 만드는 자리는 화면에서 머니 목소리를 한 번 꽂아 둡니다.
  useEffect(() => setActiveVoice(settings.voice), [settings.voice]);

  useEffect(() => () => speech.stop(), [speech]);

  // 문제가 바뀌면 입력창에 자동으로 초점을 둡니다.
  useEffect(() => {
    if (phase === 'writing') inputRef.current?.focus();
  }, [index, phase]);

  /**
   * 입력칸으로 돌아옵니다.
   *
   * 버튼을 누르면 포커스가 그 버튼으로 옮겨 가는데, 아무도 되돌려 주지 않으면
   * 폰에서는 키보드가 내려가고 PC에서는 키를 눌러도 글자가 안 들어갑니다.
   * 원고지 모드는 입력칸이 투명해서 아무 표시도 없이 먹통이 된 것처럼 보입니다.
   *
   * `focus()`는 커서 자리를 건드리지 않으므로 쓰던 자리에서 이어 씁니다.
   * 부품이 갈릴 때(쓰기 모드 전환)도 쓸 수 있게 다음 차례로 미룹니다.
   */
  const refocus = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const play = useCallback(
    async (style: ReadingStyle) => {
      if (!current) return;
      setSpeaking(style);
      await speech.play(current.sentence, rate, style);
      setSpeaking(null);
      // 다 듣고 나서 돌려줍니다. 듣는 도중에 키보드가 올라오면 버튼을 가립니다.
      refocus();
    },
    [current, rate, speech, refocus],
  );

  /** 나가기 — 진행 중이면 기록이 저장되지 않음을 알립니다. */
  const handleExit = () => {
    if (started && !window.confirm(LEAVE_MESSAGE)) return;
    speech.stop();
    onExit();
  };

  /** 1단계 — 최종 확인으로 */
  const askConfirm = () => {
    if (phase !== 'writing' || !typed.trim()) return;
    speech.stop();
    /*
      원고지에 썼으면 여기서 문장으로 바꿔 둡니다.

      격자는 보여 주는 방식일 뿐이고 입력칸에는 친 글자가 그대로 담깁니다.
      아이가 원고지 규칙대로 쉼표 뒤를 붙여 쓰면 "마시고,빵도"가 되는데,
      그대로 채점에 넘기면 띄어쓰기를 틀렸다고 나옵니다 — 규칙을 지켰는데 벌을 받는 셈입니다.

      최종 확인 화면에도 이 값을 보여 줍니다.
      눈에 보이는 문장과 채점될 문장이 다르면 확인 단계가 뜻을 잃습니다.
    */
    setPending(writeMode === 'wongoji' ? writingToText(typed) : typed);
    setPhase('confirming');
  };

  /** 2단계 — 실제 채점 */
  const submit = () => {
    if (phase !== 'confirming' || !current) return;
    const graded = grade(current.sentence, pending);
    if (graded.correct) sfx.correct();
    else sfx.wrong();
    setResult(graded);
    setPhase('reviewing');
  };

  const next = () => {
    if (!result || !current) return;
    const nextOutcomes: SessionOutcome[] = [
      ...outcomes,
      {
        refId: current.refId,
        content: current.sentence,
        correct: result.correct,
        errorTypes: result.errorTypes,
      },
    ];

    setResult(null);
    setTyped('');
    setPending('');

    if (!isLast) {
      setOutcomes(nextOutcomes);
      setIndex((i) => i + 1);
      setPhase('writing');
      return;
    }

    // 마지막 문제 — 여기서만 기록을 확정합니다.
    if (completedRef.current) return;
    completedRef.current = true;
    speech.stop();
    onComplete(nextOutcomes, scoreOf(nextOutcomes));
  };

  if (!current) {
    return (
      <div className="page">
        <p className="surface p-6 text-center" style={{ color: 'var(--ink-soft)' }}>
          풀 문장이 없어요. 세트를 먼저 만들어 주세요.
        </p>
      </div>
    );
  }

  const starNote =
    phase === 'reviewing' && result && starNoteFor
      ? starNoteFor(current.refId, result.correct)
      : null;

  return (
    /*
      원고지로 쓸 때만 기둥을 넓힙니다(안쪽 720px).
      15칸 격자는 폭이 곧 글자 크기라 좁으면 글자가 작아집니다.
      「그냥 쓰기」는 한 줄짜리 입력칸이라 넓힐 까닭이 없습니다 —
      넓히면 오히려 한 줄이 길어져 눈이 되돌아오기 힘들어집니다.
    */
    <div className={writeMode === 'wongoji' ? 'page page--write' : 'page'}>
      {/* 상단 — 진행 상황 */}
      <header className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={handleExit} className="btn btn-quiet" aria-label="나가기">
            ←
          </button>
          <h1 className="display flex-1 truncate text-lg font-bold">{title}</h1>
          <span
            className="rounded px-2 py-1 text-[11px] font-bold"
            style={{
              background: mode === 'exam' ? 'var(--pen-tint)' : 'var(--grid-tint)',
              color: mode === 'exam' ? 'var(--pen-deep)' : 'var(--grid-deep)',
            }}
          >
            {mode === 'exam' ? '시험' : '연습'}
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
                // 아래 숫자 라벨(`2 / 5`)과 같은 것을 가리키게 맞춥니다.
                // 푼 개수로 두면 마지막 문제에서도 막대가 차지 않아 아직 남은 것처럼 보입니다.
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

      {/* 듣기 */}
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
                /*
                  다음에도 이어지도록 **이 아이 것으로** 기억합니다.
                  형제가 같은 기기를 써도 서로의 속도를 건드리지 않습니다.
                  기다리지 않습니다 — 눌린 느낌이 먼저입니다.
                */
                void saveSettings('child', { rate: r });
                refocus();
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

        <p className="text-center text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
          띄어쓰기가 헷갈리면 또박또박 듣기를 눌러 보세요
        </p>
      </section>

      {/* 입력 */}
      {phase === 'writing' && (
        <>
          {/*
            여기에 「그냥 쓰기 / 원고지에 쓰기」 버튼이 있었습니다. 뺐습니다.

            **쓰던 중에 바꾸면 채점이 뒤집힙니다.**
            원고지 모드에서만 쉼표 규칙을 문장으로 되돌리기 때문입니다.
            아이가 규칙대로 「우유를 마시고,빵도 먹어요.」라고 써 놓고
            그냥 쓰기로 바꾸면, 글자는 하나도 안 바뀌었는데 띄어쓰기를 틀렸다고 나옵니다.
            아이는 자기가 뭘 잘못했는지 알 방법이 없습니다.

            원래는 「써 보고 불편하면 그 자리에서 바꾸게」 두었던 것인데,
            쓰기 방법은 속도와 다릅니다. 속도는 문장마다 「이건 잘 안 들려」가 있지만
            원고지에 쓸지 말지는 그날그날 달라지지 않습니다. 한 번 정하면 그만입니다.
            그래서 보호자 설정으로 옮겼습니다.
          */}
          <label
            htmlFor="answer"
            className="mb-2 block text-sm"
            style={{ color: 'var(--ink-soft)' }}
          >
            들은 문장을 써 보세요
          </label>

          {writeMode === 'wongoji' ? (
            <WongojiInput
              value={typed}
              onChange={setTyped}
              onEnter={askConfirm}
              inputRef={inputRef}
              maxLength={SENTENCE_MAX}
            />
          ) : (
            <input
              id="answer"
              ref={inputRef}
              className="field field-answer"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') askConfirm();
              }}
              placeholder="여기에 써요"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
            />
          )}
          <button
            onClick={askConfirm}
            disabled={!typed.trim()}
            className="btn btn-primary btn-lg mt-3"
          >
            확인
          </button>
        </>
      )}

      {/* 최종 확인 */}
      {phase === 'confirming' && (
        <section
          className="surface rise-in flex flex-col items-center gap-3 p-5"
          style={{ borderColor: 'var(--grid)', borderWidth: 2 }}
        >
          <p className="display text-base font-bold" style={{ color: 'var(--grid-deep)' }}>
            이대로 제출할까요?
          </p>
          {/*
            쓸 때 본 그대로 보여 줍니다.

            여기만 한 줄짜리 글이었습니다. 쓰기(원고지) → 확인(글) → 채점(원고지)이라
            가운데서만 모양이 바뀌었는데, 하필 여기가 "내가 쓴 게 이거 맞나?"를
            아이에게 묻는 자리입니다. 견줄 것을 다른 모양으로 내밀면 대답할 수가 없습니다.

            특히 쉼표 — 원고지 규칙대로 붙여 쓴 아이가 여기서 공백이 되살아난 문장을 보면
            자기가 틀린 줄 알고 「다시 고치기」를 누릅니다. 바르게 썼는데도요.
          */}
          {writeMode === 'wongoji' ? (
            <WongojiSheet cells={padToGrid(toCells(pending), 1)} fill label="제출할 문장" />
          ) : (
            <p
              className="w-full rounded-sm px-4 py-3 text-center text-xl"
              style={{ background: 'var(--paper-sunk)', letterSpacing: '0.04em' }}
            >
              {pending}
            </p>
          )}
          <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            제출하면 채점돼요
          </p>
          <div className="flex w-full gap-2">
            <button
              onClick={() => {
                setPhase('writing');
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="btn btn-secondary flex-1"
            >
              다시 고치기
            </button>
            <button onClick={submit} className="btn btn-primary flex-1">
              제출하기
            </button>
          </div>
        </section>
      )}

      {/* 채점 결과 */}
      {phase === 'reviewing' && result && (
        <>
          <GradeSheet result={result} note={starNote} />
          {/* 틀렸으면 정답을 볼 틈을 줍니다 — 습관처럼 누르다 지나치지 않게 */}
          <NextButton hold={!result.correct} onClick={next}>
            {isLast ? '결과 보기' : '다음 문제'}
          </NextButton>
        </>
      )}
    </div>
  );
}
