'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NextButton } from './NextButton';
import { SessionResult } from './SessionResult';
import type { SpellingKind, SpellingQuestion } from '@/data/spelling-bank';
import { initSfx, sfx } from '@/lib/sfx';
import { saveSession, starNoteFactory } from '@/lib/save-session';
import { LEAVE_MESSAGE, useLeaveGuard } from '@/lib/use-leave-guard';
import type { CompleteSessionResponse, OutcomePayload } from '@/lib/session';
import type { Mode } from '@/lib/types';

/**
 * 맞춤법 한 세션.
 *
 * 받아쓰기와 같은 규칙을 따릅니다.
 * - 고른 답을 보여주고 한 번 더 확인한 뒤에 채점합니다(절대 원칙 3).
 * - 끝까지 마쳤을 때만 저장합니다(절대 원칙 2). 중간에 나가면 아무것도 남지 않습니다.
 * - 보상은 결과 화면에서만. 푸는 도중에는 맞았는지만 알려 줍니다.
 *
 * 설명(explanation)은 틀렸을 때만 보여 줍니다.
 * 맞힌 문제에까지 규칙을 붙이면 읽지 않게 되고, 정작 필요할 때도 넘겨 버립니다.
 */

type Phase = 'answering' | 'confirming' | 'reviewing';

export function SpellingRunner({
  childId,
  questions,
  kind,
  kindLabel,
  mode,
  listHref,
  retryHref,
  starNotes,
}: {
  childId: string;
  /**
   * 낼 문제들.
   *
   * `originRefId` 가 붙어 있으면 **짝 문제**입니다 — 화면에는 이 문항을 내지만
   * 오답노트에는 원본의 id 로 기록합니다. 짝의 id 로 적으면 그것이
   * 새 오답노트가 되어 목록이 끝없이 불어납니다.
   */
  questions: Array<SpellingQuestion & { originRefId?: string }>;
  kind: SpellingKind | null;
  kindLabel: string;
  mode: Mode;
  listHref: string;
  retryHref: string;
  starNotes?: Record<string, { streak: number; lastCorrectDate: string | null }>;
}) {
  const router = useRouter();

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  const [choice, setChoice] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<OutcomePayload[]>([]);
  const [result, setResult] = useState<CompleteSessionResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finished = useRef<OutcomePayload[] | null>(null);
  const completedRef = useRef(false);

  useEffect(() => initSfx(), []);

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const correct = phase === 'reviewing' && choice === current?.answer;
  const starNoteFor = starNotes ? starNoteFactory(starNotes) : null;

  // 한 문제라도 손대기 시작하면 그때부터 나가기를 붙잡습니다.
  const started = outcomes.length > 0 || choice !== null;
  useLeaveGuard(started && !completedRef.current, LEAVE_MESSAGE);

  const send = async (list: OutcomePayload[]) => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveSession({
        childId,
        module: 'spelling',
        mode,
        spellingKind: kind,
        sourceName: kindLabel,
        outcomes: list,
      });
      setResult(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : '기록을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const handleExit = () => {
    if (started && !window.confirm(LEAVE_MESSAGE)) return;
    router.push(listHref);
  };

  const submit = () => {
    if (!current || choice === null) return;
    if (choice === current.answer) sfx.correct();
    else sfx.wrong();
    setPhase('reviewing');
  };

  const next = () => {
    if (!current || choice === null) return;

    const nextOutcomes: OutcomePayload[] = [
      ...outcomes,
      {
        refId: current.originRefId ?? current.id,
        wasTwin: current.originRefId !== undefined,
        content: current.prompt,
        correct: choice === current.answer,
        // 맞춤법은 오류 '유형'이 아니라 헷갈리는 말 자체가 약점입니다.
        errorTypes: [current.tag],
      },
    ];

    setChoice(null);

    if (!isLast) {
      setOutcomes(nextOutcomes);
      setIndex((i) => i + 1);
      setPhase('answering');
      return;
    }

    if (completedRef.current) return;
    completedRef.current = true;
    finished.current = nextOutcomes;
    void send(nextOutcomes);
  };

  /* ------------------------------------------------------- 결과·저장 상태 */

  if (result) {
    const wrongIds = new Set(
      (finished.current ?? []).filter((o) => !o.correct).map((o) => o.refId),
    );
    return (
      <SessionResult
        result={result}
        mode={mode}
        title={kindLabel}
        wrongItems={questions
          .filter((q) => wrongIds.has(q.id))
          .map((q) => `${q.prompt} → ${q.answer}`)}
        retryHref={retryHref}
        listHref={listHref}
      />
    );
  }

  if (saving || error) {
    return (
      <div className="page">
        <div className="surface mt-12 p-6 text-center">
          {saving ? (
            <p style={{ color: 'var(--ink-soft)' }}>기록을 저장하고 있어요…</p>
          ) : (
            <>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--pen-deep)' }}>
                {error}
                <br />푼 내용은 그대로 있어요. 다시 보낼 수 있어요.
              </p>
              <button
                className="btn btn-primary btn-lg mt-4"
                onClick={() => finished.current && send(finished.current)}
              >
                다시 저장하기
              </button>
              {/* 서버가 계속 안 될 때 갇히지 않도록 나가는 길을 둡니다. */}
              <button
                className="btn btn-quiet mt-2 w-full justify-center"
                onClick={() => router.push(listHref)}
              >
                나중에 하기 (이번 기록은 남지 않아요)
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="page">
        <p className="surface mt-12 p-6 text-center" style={{ color: 'var(--ink-soft)' }}>
          풀 문제가 없어요.
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------- 문제 화면 */

  const preview =
    current.kind === 'find'
      ? current.prompt
      : current.prompt.replace('___', choice ?? '___');

  return (
    <div className="page">
      <header className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={handleExit} className="btn btn-quiet" aria-label="나가기">
            ←
          </button>
          <h1 className="display flex-1 truncate text-lg font-bold">{kindLabel}</h1>
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
                // 옆 숫자 라벨과 같은 것을 가리키게 맞춥니다.
                width: `${((index + 1) / questions.length) * 100}%`,
                background: 'var(--grid)',
              }}
            />
          </div>
          <span className="text-xs tabular-nums" style={{ color: 'var(--ink-faint)' }}>
            {index + 1} / {questions.length}
          </span>
        </div>
      </header>

      <section className="surface mb-4 p-5 text-center">
        <p className="mb-1 text-xs" style={{ color: 'var(--ink-faint)' }}>
          {current.kind === 'find' ? '틀린 낱말을 눌러 보세요' : '알맞은 말을 골라 보세요'}
        </p>
        <p className="display text-[22px] leading-relaxed">{current.prompt}</p>
      </section>

      {phase === 'answering' && (
        <>
          {current.kind === 'find' ? (
            <div className="mb-3 flex flex-wrap justify-center gap-2">
              {current.options.map((word) => (
                <button
                  key={word}
                  onClick={() => setChoice(word)}
                  className="btn"
                  style={{
                    background: choice === word ? 'var(--grid)' : 'var(--card)',
                    color: choice === word ? '#fff' : 'var(--ink)',
                    border: `1px solid ${choice === word ? 'var(--grid)' : 'var(--rule-strong)'}`,
                    fontSize: 18,
                  }}
                >
                  {word}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-3 grid grid-cols-2 gap-2.5">
              {current.options.map((option) => (
                <button
                  key={option}
                  onClick={() => setChoice(option)}
                  className="btn"
                  style={{
                    background: choice === option ? 'var(--grid)' : 'var(--card)',
                    color: choice === option ? '#fff' : 'var(--ink)',
                    border: `1px solid ${choice === option ? 'var(--grid)' : 'var(--rule-strong)'}`,
                    fontSize: 20,
                    padding: '18px 12px',
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setPhase('confirming')}
            disabled={choice === null}
            className="btn btn-primary btn-lg"
          >
            확인
          </button>
        </>
      )}

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
            style={{ background: 'var(--paper-sunk)' }}
          >
            {current.kind === 'find' ? (
              <>
                틀린 낱말: <b style={{ color: 'var(--pen-deep)' }}>{choice}</b>
              </>
            ) : (
              preview
            )}
          </p>
          <div className="flex w-full gap-2">
            <button onClick={() => setPhase('answering')} className="btn btn-secondary flex-1">
              다시 고르기
            </button>
            <button onClick={submit} className="btn btn-primary flex-1">
              제출하기
            </button>
          </div>
        </section>
      )}

      {phase === 'reviewing' && (
        <>
          <section
            className="surface rise-in p-4"
            style={{ borderColor: correct ? 'var(--grid)' : 'var(--pen)', borderWidth: 2 }}
          >
            <div
              className="display mb-4 rounded py-3 text-center text-[22px] font-bold"
              style={
                correct
                  ? { color: 'var(--grid-deep)', background: 'var(--grid-tint)' }
                  : { color: '#fff', background: 'var(--pen)' }
              }
            >
              {correct ? '맞았어요' : '다시 볼까요'}
            </div>

            <p className="text-center text-lg leading-relaxed">
              {current.kind === 'find' ? (
                <>
                  틀린 낱말은{' '}
                  <b style={{ color: 'var(--pen-deep)' }}>{current.answer}</b>이고,
                  <br />
                  맞는 표기는{' '}
                  <b style={{ color: 'var(--grid-deep)' }}>{current.correction}</b>예요
                </>
              ) : (
                <>
                  정답은{' '}
                  <b style={{ color: 'var(--grid-deep)' }}>{current.answer}</b> 예요
                </>
              )}
            </p>

            {!correct && (
              <p
                className="mt-4 rounded-sm px-3 py-2.5 text-sm leading-relaxed"
                style={{ background: 'var(--paper-sunk)', color: 'var(--ink-soft)' }}
              >
                {current.explanation}
              </p>
            )}

            <div className="mt-3 flex justify-center">
              <span className="tag tag--letter">{current.tag}</span>
            </div>

            {starNoteFor?.(current.id, correct) && (
              <p
                className="mt-4 rounded-sm px-3 py-2.5 text-center text-sm"
                style={{ background: 'var(--gold-tint)', color: '#6d520c' }}
              >
                {starNoteFor(current.id, correct)}
              </p>
            )}
          </section>

          {/* 틀렸으면 정답과 설명을 볼 틈을 줍니다 */}
          <NextButton hold={!correct} onClick={next}>
            {isLast ? '결과 보기' : '다음 문제'}
          </NextButton>
        </>
      )}
    </div>
  );
}
