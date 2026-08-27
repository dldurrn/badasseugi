'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GradeSheet } from './GradeSheet';
import { NextButton } from './NextButton';
import type { SpellingQuestion } from '@/data/spelling-bank';
import { grade, type GradeResult } from '@/lib/grading';
import { saveSession } from '@/lib/save-session';
import { initSfx, sfx } from '@/lib/sfx';
import { SpeechController } from '@/lib/tts';
import { appSpeech, readRate } from '@/lib/tts-app';
import type { Module } from '@/lib/types';
import { SENTENCE_MAX } from '@/lib/sets';
import { padToGrid, toCells, writingToText } from '@/lib/wongoji';
import { readWriteMode, type WriteMode } from '@/lib/write-mode';
import { WongojiInput } from './WongojiInput';
import { WongojiSheet } from './WongojiSheet';

/**
 * 오답노트 목록에서 그 자리 풀기.
 *
 * 예전에는 항목을 누르면 세션 화면으로 나갔다가 결과 화면을 거쳐 돌아왔습니다.
 * 오답 하나를 치우는 데 화면을 네 번 옮겨 다녀야 했습니다.
 * 목록 안에서 펼쳐 풀면 걸음이 하나로 줄어듭니다(절대 원칙 10).
 *
 * 규칙은 세션과 똑같이 지킵니다.
 * - 제출 전 확인 단계를 거칩니다(절대 원칙 3).
 * - 브라우저 맞춤법 교정을 끕니다(절대 원칙 4).
 * - 다만 이건 '세션'이 아니라 복습 한 번이라 풀이 기록(attempts)에는 남기지 않습니다.
 *   별과 졸업은 그대로 반영됩니다.
 */

type Phase = 'writing' | 'confirming' | 'done';

interface Props {
  childId: string;
  module: Module;
  refId: string;
  content: string;
  /** 맞춤법일 때만. 문제은행에서 찾아 넘겨 주세요. */
  question?: SpellingQuestion;
  onClose: () => void;
}

export function InlineNotePractice({
  childId,
  module,
  refId,
  content,
  question,
  onClose,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('writing');
  const [typed, setTyped] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [writeMode, setWriteMode] = useState<WriteMode>('wongoji');
  useEffect(() => setWriteMode(readWriteMode()), []);
  const [correct, setCorrect] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  // 서버 음성을 먼저 쓰고 안 되면 브라우저 음성으로 넘어갑니다.
  // 서버가 어느 회사를 쓰는지는 여기서 알 필요가 없습니다(lib/tts-engines.ts).
  const speech = useMemo(() => new SpeechController(appSpeech), []);

  useEffect(() => {
    initSfx();
    inputRef.current?.focus();
    return () => speech.stop();
  }, [speech]);

  /*
    받아쓰기는 채점에 넘길 문장을 여기서 만듭니다.

    원고지에 썼으면 쉼표 뒤를 붙여 쓴 것을 문장으로 되돌려 놓아야 합니다.
    그러지 않으면 규칙대로 쓴 아이가 띄어쓰기를 틀렸다는 채점을 받습니다.
    확인 화면에 보여 주는 값도 이것이라, 눈에 보이는 문장이 곧 채점될 문장입니다.
  */
  const answer =
    module === 'spelling'
      ? (choice ?? '')
      : writeMode === 'wongoji'
        ? writingToText(typed)
        : typed;
  const canConfirm = answer.trim().length > 0;

  const play = async (style: 'flow' | 'chunked') => {
    setSpeaking(true);
    // 설정과 세션 화면에서 정한 속도를 그대로 씁니다.
    await speech.play(content, readRate(), style);
    setSpeaking(false);
    // 듣고 나면 쓰던 자리로 돌려줍니다. 안 그러면 키보드가 내려간 채로 남습니다.
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    speech.stop();

    let isCorrect: boolean;
    let errorTypes: string[];

    if (module === 'spelling' && question) {
      isCorrect = choice === question.answer;
      errorTypes = [question.tag];
    } else {
      // 확인 화면에 보여 준 그 문장을 그대로 채점합니다.
      const graded = grade(content, answer);
      setResult(graded);
      isCorrect = graded.correct;
      errorTypes = graded.errorTypes;
    }

    setCorrect(isCorrect);
    if (isCorrect) sfx.correct();
    else sfx.wrong();

    try {
      const saved = await saveSession({
        childId,
        module,
        mode: 'practice',
        outcomes: [{ refId, content, correct: isCorrect, errorTypes }],
        // 복습 한 번은 리포트의 평균 점수를 흔들지 않게 기록에서 뺍니다.
        logAttempt: false,
      });

      // 안내 문구는 서버가 실제로 판정한 결과를 그대로 씁니다.
      // 화면에서 별 개수를 짐작하면 서버와 어긋날 수 있습니다.
      if (saved.graduated > 0) setNote('별 두 개를 다 모았어요! 졸업이에요.');
      else if (saved.starsEarned > 0) setNote('별을 하나 받았어요. 한 번 더 맞히면 졸업이에요.');
      else if (!isCorrect) setNote('별이 처음으로 돌아갔어요. 다시 모아 봐요.');
      else setNote(null);

      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
      setPhase('done');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    speech.stop();
    // 별이 바뀌었으니 목록을 다시 그립니다.
    router.refresh();
    onClose();
  };

  /* --------------------------------------------------------------- 결과 */

  if (phase === 'done') {
    return (
      <div className="rise-in mt-3 border-t pt-3" style={{ borderColor: 'var(--rule)' }}>
        {module === 'spelling' && question ? (
          <div
            className="rounded p-3 text-center"
            style={{
              background: correct ? 'var(--grid-tint)' : 'var(--pen-tint)',
              border: `1.5px solid ${correct ? 'var(--grid)' : 'var(--pen)'}`,
            }}
          >
            <p
              className="display text-base font-bold"
              style={{ color: correct ? 'var(--grid-deep)' : 'var(--pen-deep)' }}
            >
              {correct ? '맞았어요' : '다시 볼까요'}
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              {question.kind === 'find' ? (
                <>
                  틀린 낱말은{' '}
                  <b style={{ color: 'var(--pen-deep)' }}>{question.answer}</b>이고,{' '}
                  맞는 표기는{' '}
                  <b style={{ color: 'var(--grid-deep)' }}>{question.correction}</b>예요
                </>
              ) : (
                <>
                  정답은 <b style={{ color: 'var(--grid-deep)' }}>{question.answer}</b> 예요
                </>
              )}
            </p>
            {!correct && (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {question.explanation}
              </p>
            )}
          </div>
        ) : (
          result && <GradeSheet result={result} wongoji={writeMode === 'wongoji'} />
        )}

        {note && (
          <p
            className="mt-3 rounded-sm px-3 py-2.5 text-center text-sm"
            style={{ background: 'var(--gold-tint)', color: '#6d520c' }}
          >
            {note}
          </p>
        )}

        {error && (
          <p
            className="mt-3 rounded-sm px-3 py-2.5 text-center text-sm"
            style={{ background: 'var(--pen-tint)', color: 'var(--pen-deep)' }}
          >
            {error} 별은 다음에 다시 세어져요.
          </p>
        )}

        {/* 틀렸으면 정답을 볼 틈을 줍니다. 접으면 다시 못 보니까요. */}
        <NextButton hold={!correct} onClick={close} holdLabel="정답을 보고 닫아요">
          닫기
        </NextButton>
      </div>
    );
  }

  /* ----------------------------------------------------------- 확인 단계 */

  if (phase === 'confirming') {
    return (
      <div
        className="rise-in mt-3 rounded p-3 text-center"
        style={{ border: '2px solid var(--grid)' }}
      >
        <p className="display text-sm font-bold" style={{ color: 'var(--grid-deep)' }}>
          이대로 제출할까요?
        </p>
        {/* 쓸 때 본 그대로 — 세션 화면과 같은 이유입니다 */}
        {module === 'dictation' && writeMode === 'wongoji' ? (
          <div className="my-2">
            <WongojiSheet cells={padToGrid(toCells(answer), 1)} fill label="제출할 문장" />
          </div>
        ) : (
          <p
            className="my-2 rounded-sm px-3 py-2 text-lg"
            style={{ background: 'var(--paper-sunk)', letterSpacing: '0.04em' }}
          >
            {answer}
          </p>
        )}
        <div className="flex gap-2">
          <button
            className="btn btn-secondary flex-1"
            onClick={() => {
              setPhase('writing');
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            다시 고치기
          </button>
          <button className="btn btn-primary flex-1" onClick={submit} disabled={busy}>
            제출하기
          </button>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------------- 풀기 */

  return (
    <div className="rise-in mt-3 border-t pt-3" style={{ borderColor: 'var(--rule)' }}>
      {module === 'spelling' && question ? (
        <>
          <p className="mb-1 text-center text-xs" style={{ color: 'var(--ink-faint)' }}>
            {question.kind === 'find' ? '틀린 낱말을 눌러 보세요' : '알맞은 말을 골라 보세요'}
          </p>
          <p className="mb-2 text-center text-[15px]">{question.prompt}</p>
          <div
            className={
              question.kind === 'find'
                ? 'mb-3 flex flex-wrap justify-center gap-2'
                : 'mb-3 grid grid-cols-2 gap-2'
            }
          >
            {question.options.map((option) => (
              <button
                key={option}
                onClick={() => setChoice(option)}
                className="btn"
                style={{
                  background: choice === option ? 'var(--grid)' : 'var(--card)',
                  color: choice === option ? '#fff' : 'var(--ink)',
                  border: `1px solid ${choice === option ? 'var(--grid)' : 'var(--rule-strong)'}`,
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mb-2 flex justify-center gap-2">
            <button
              onClick={() => play('flow')}
              disabled={speaking}
              className="btn btn-secondary"
              style={{ borderRadius: 999, padding: '9px 16px', fontSize: 13.5 }}
            >
              {speaking ? '읽는 중…' : '듣기'}
            </button>
            <button
              onClick={() => play('chunked')}
              disabled={speaking}
              className="btn btn-secondary"
              style={{ borderRadius: 999, padding: '9px 16px', fontSize: 13.5 }}
            >
              또박또박
            </button>
          </div>
          {/* 세션 화면과 같은 쓰기 모드를 씁니다. 여기만 다르면 아이가 헷갈립니다. */}
          {writeMode === 'wongoji' ? (
            <WongojiInput
              value={typed}
              onChange={setTyped}
              onEnter={() => {
                if (canConfirm) setPhase('confirming');
              }}
              inputRef={inputRef}
              maxLength={SENTENCE_MAX}
            />
          ) : (
            <input
              ref={inputRef}
              className="field field-answer"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canConfirm) setPhase('confirming');
              }}
              placeholder="들은 문장을 써요"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
            />
          )}
        </>
      )}

      <div className="mt-2 flex gap-2">
        <button className="btn btn-quiet flex-1" onClick={close}>
          그만두기
        </button>
        <button
          className="btn btn-primary flex-1"
          onClick={() => setPhase('confirming')}
          disabled={!canConfirm}
        >
          확인
        </button>
      </div>
    </div>
  );
}
