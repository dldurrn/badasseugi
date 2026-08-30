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
import { appSpeech, setActiveVoice } from '@/lib/tts-app';
import type { TwinStep } from '@/lib/twin';
import type { Module } from '@/lib/types';
import { SENTENCE_MAX } from '@/lib/sets';
import { padToGrid, toCells, writingToText } from '@/lib/wongoji';
import type { Settings } from '@/lib/settings';
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

/**
 * `bridge` 는 **원본을 맞히고 짝으로 넘어가기 직전**입니다.
 * 곧바로 다음 문제를 들이밀지 않고 한 박자 둡니다 —
 * 방금 맞혔다는 것을 알고 넘어가야 두 번째가 벌처럼 느껴지지 않습니다.
 */
type Phase = 'writing' | 'confirming' | 'bridge' | 'done';

interface Props {
  childId: string;
  module: Module;
  /** **언제나 원본 노트의 것**입니다. 짝을 풀 때도 이 값을 서버에 보냅니다 */
  refId: string;
  content: string;
  /** 맞춤법일 때만. 문제은행에서 찾아 넘겨 주세요. */
  question?: SpellingQuestion;
  /**
   * 두 번째 걸음. 없으면 예전처럼 **원본을 두 번** 풀어 졸업합니다.
   * (아직 못 만들었거나 만들다 실패한 경우입니다)
   */
  twin?: { content: string; question?: SpellingQuestion };
  /** 별을 하나 받아 둔 상태로 다시 열면 짝부터 시작합니다 */
  startStep?: TwinStep;
  onClose: () => void;
  /** 서버가 읽어 내려준 값 */
  settings: Settings;
}

export function InlineNotePractice({
  childId,
  module,
  refId,
  content: origin,
  question: originQuestion,
  twin,
  startStep,
  onClose,
  settings,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('writing');
  const [step, setStep] = useState<TwinStep>(twin ? (startStep ?? 'origin') : 'origin');

  /*
    지금 걸음에 맞는 문제를 여기서 한 번만 정합니다.
    아래 화면들은 **어느 걸음인지 몰라도** 됩니다 — 듣기도, 채점도, 그리기도 그대로입니다.
  */
  const content = step === 'twin' && twin ? twin.content : origin;
  const question = step === 'twin' && twin ? twin.question : originQuestion;
  const [typed, setTyped] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const writeMode = settings.writeMode;
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
    setActiveVoice(settings.voice);
    inputRef.current?.focus();
    return () => speech.stop();
  }, [speech, settings.voice]);

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
    await speech.play(content, settings.rate, style);
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
        /*
          refId 는 **언제나 원본의 것**입니다. 짝의 것을 보내면 서버가 그것을
          새 오답노트로 만들어 버려 목록이 끝없이 불어납니다 —
          짝은 이 노트의 두 번째 걸음이지 별개의 문제가 아닙니다.
        */
        outcomes: [
          {
            refId,
            content,
            correct: isCorrect,
            errorTypes,
            wasTwin: step === 'twin',
            // 다음 짝을 겨눠 만들려면 아이가 무엇을 썼는지 알아야 합니다.
            input: answer,
          },
        ],
        // 복습 한 번은 리포트의 평균 점수를 흔들지 않게 기록에서 뺍니다.
        logAttempt: false,
      });

      // 안내 문구는 서버가 실제로 판정한 결과를 그대로 씁니다.
      // 화면에서 별 개수를 짐작하면 서버와 어긋날 수 있습니다.
      if (saved.graduated > 0) setNote('별 두 개를 다 모았어요! 졸업이에요.');
      else if (saved.starsEarned > 0) setNote('별을 하나 받았어요. 한 번 더 맞히면 졸업이에요.');
      else if (!isCorrect) setNote('별이 처음으로 돌아갔어요. 다시 모아 봐요.');
      else setNote(null);

      /*
        원본을 맞혔고 짝이 있으면 **닫지 않고 이어서** 풉니다.
        여기서 닫아 버리면 아이가 목록에서 같은 항목을 다시 찾아 눌러야 하는데,
        방금 맞힌 것을 또 누르라는 것이 되어 이상합니다(절대 원칙 10).
      */
      if (isCorrect && step === 'origin' && twin) setPhase('bridge');
      else setPhase('done');
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

  /** 짝으로 넘어갑니다. 방금 푼 것은 지우고 처음처럼 시작합니다. */
  const goTwin = () => {
    speech.stop();
    setStep('twin');
    setTyped('');
    setChoice(null);
    setResult(null);
    setNote(null);
    setError(null);
    setPhase('writing');
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  /* ------------------------------------------------- 짝으로 넘어가기 전 */

  /*
    쓰기·확인·결과와 **같은 껍데기**입니다 — 카드 안에 줄 하나 긋고 이어 붙입니다.

    처음에는 여기에 `surface note--writing` 을 줬다가 화면이 무너졌습니다.
    `.note--writing` 은 **카드째 넓히는** 것이라 NoteItem 의 `<li>` 가 이미 쓰고 있습니다.
    넓혀진 카드 안에서 또 넓히니 상자가 카드 밖으로 밀려났습니다.

    이 걸음만 다른 껍데기를 쓸 까닭이 없었습니다. 나머지 셋과 같게 두면 그만입니다.
  */
  if (phase === 'bridge') {
    return (
      <div className="rise-in mt-3 border-t pt-3" style={{ borderColor: 'var(--rule)' }}>
        <p className="display text-base font-bold" style={{ color: 'var(--grid-deep)', margin: 0 }}>
          맞았어요! 별 하나 ★
        </p>
        {/*
          왜 다른 문장이 나오는지 아이가 알아야 합니다.
          모르면 시험 문제가 바뀐 것으로 느끼고, 맞힌 상이 벌처럼 됩니다.
        */}
        <p
          className="mt-1.5 text-sm leading-relaxed"
          style={{ color: 'var(--ink-soft)', margin: '6px 0 0' }}
        >
          이번엔 <b style={{ color: 'var(--ink)' }}>다른 문장</b>으로 한 번 더 해 봐요.
          {module === 'spelling' ? ' 같은 규칙의 다른 문제예요.' : ' 방금 것과 비슷한 문장이에요.'}
          <br />
          이것까지 맞히면 졸업이에요!
        </p>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary flex-1 justify-center" onClick={goTwin} autoFocus>
            해 볼래요
          </button>
          {/*
            나가도 별 하나는 남습니다. 다음에 열면 짝부터 이어서 풉니다 —
            중도 이탈로 기록을 버리는 것(절대 원칙 2)은 시험 세션 이야기이고,
            여기는 이미 서버에 별이 저장된 뒤입니다.
          */}
          <button className="btn btn-secondary" onClick={close}>
            나중에
          </button>
        </div>
      </div>
    );
  }

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
          result && <GradeSheet result={result} />
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
