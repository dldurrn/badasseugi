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
import { appSpeech, RATES, readRate, writeRate } from '@/lib/tts-app';
import { LEAVE_MESSAGE, useLeaveGuard } from '@/lib/use-leave-guard';
import { GradeSheet } from './GradeSheet';
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
}: {
  items: SessionItem[];
  mode: Mode;
  title: string;
  /** 오답 연습 중 별 안내 문구를 만들어 주는 함수 (선택) */
  starNoteFor?: (refId: string, correct: boolean) => string | null;
  /** 세션을 끝까지 마쳤을 때만 호출됩니다. */
  onComplete: (outcomes: SessionOutcome[], score: number) => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('writing');
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [outcomes, setOutcomes] = useState<SessionOutcome[]>([]);
  // 서버에서 그릴 때는 localStorage를 읽을 수 없어 기본값으로 두고, 뜬 뒤에 저장된 값을 불러옵니다.
  const [rate, setRate] = useState<SpeechRate>(0.85);
  const [speaking, setSpeaking] = useState<ReadingStyle | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  // 서버(Google TTS)를 먼저 쓰고 안 되면 브라우저 음성으로 넘어갑니다.
  const speech = useMemo(() => new SpeechController(appSpeech), []);
  const completedRef = useRef(false);

  const current = items[index];
  const isLast = index === items.length - 1;

  // 한 글자라도 쓰기 시작했으면 그때부터 나가기를 붙잡습니다.
  const started = outcomes.length > 0 || typed.trim().length > 0;
  useLeaveGuard(started && !completedRef.current, LEAVE_MESSAGE);

  useEffect(() => setRate(readRate()), []);

  useEffect(() => () => speech.stop(), [speech]);

  // 문제가 바뀌면 입력창에 자동으로 초점을 둡니다.
  useEffect(() => {
    if (phase === 'writing') inputRef.current?.focus();
  }, [index, phase]);

  const play = useCallback(
    async (style: ReadingStyle) => {
      if (!current) return;
      setSpeaking(style);
      await speech.play(current.sentence, rate, style);
      setSpeaking(null);
    },
    [current, rate, speech],
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
    setPending(typed);
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
    <div className="page">
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
                // 다음 세션에서도 이어지도록 기억합니다.
                writeRate(r);
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
          <label
            htmlFor="answer"
            className="mb-2 block text-sm"
            style={{ color: 'var(--ink-soft)' }}
          >
            들은 문장을 써 보세요
          </label>
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
          <p
            className="w-full rounded-sm px-4 py-3 text-center text-xl"
            style={{ background: 'var(--paper-sunk)', letterSpacing: '0.04em' }}
          >
            {pending}
          </p>
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
          <button onClick={next} className="btn btn-primary btn-lg mt-3">
            {isLast ? '결과 보기' : '다음 문제'}
          </button>
        </>
      )}
    </div>
  );
}
