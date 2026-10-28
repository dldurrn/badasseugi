'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { grade } from '@/lib/grading';
import { DEMO_MISTAKE, DEMO_SENTENCES } from '@/lib/demo';
import { demoSpeech } from '@/lib/demo-speech';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { countTrial } from '@/lib/trial';
import { padToGrid, toCells } from '@/lib/wongoji';
import { DictationSession } from './DictationSession';
import { GradeSheet } from './GradeSheet';
import { WongojiSheet } from './WongojiSheet';

/**
 * 로그인 전 첫 화면 — 한 문장 써 보기(`/try`).
 *
 * 예전에는 링크를 누르면 곧바로 이메일 칸이 떴습니다. 무엇을 해 주는 앱인지 하나도 모른 채
 * 가입부터 하라는 셈이라, 홍보로 데려온 사람이 거의 다 거기서 닫았습니다.
 * **이 앱의 「아!」는 채점표입니다.** 그걸 가입 전에 30초 안에 겪게 합니다.
 *
 * 진짜 받아쓰기 화면(`DictationSession`)을 그대로 씁니다 — 원고지, 확인 단계, 채점표가
 * 앱과 똑같아야 「이걸 아이가 혼자 한다」가 그려집니다. 다른 것은 두 가지뿐입니다.
 * - 소리는 미리 만든 파일(`demo-speech.ts`). 로그인 전이라 `/api/tts` 를 못 부릅니다.
 * - **아무것도 저장하지 않습니다.** 그래서 나가기 확인도, 보상도 없습니다(절대 원칙 1·2).
 *   쓴 글자는 서버로 안 갑니다 — 채점은 이 브라우저 안에서 끝납니다(절대 원칙 7).
 *
 * 세는 것은 횟수뿐입니다(`trial.ts`).
 */

type Stage = 'intro' | 'writing' | 'after';

/** 「지금은 무료」를 어떻게 말할지 — 나중에 유료로 바꿔도 거짓말이 안 되는 말만 씁니다 */
const FREE_NOTE = '지금은 무료로 열어 두었어요. 원고지·채점·오답노트는 앞으로도 무료예요.';

export function TrialLanding() {
  const [stage, setStage] = useState<Stage>('intro');
  const [index, setIndex] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const started = useRef(false);
  const finished = useRef(false);

  // 그림이 아니라 실제 채점 엔진의 결과입니다. 엔진이 바뀌면 이것도 따라 바뀝니다.
  const mistake = useMemo(() => grade(DEMO_MISTAKE.answer, DEMO_MISTAKE.written), []);

  const current = DEMO_SENTENCES[index];
  const hasMore = index < DEMO_SENTENCES.length - 1;

  const begin = () => {
    if (!started.current) {
      started.current = true;
      countTrial('start');
    }
    setStage('writing');
    window.scrollTo({ top: 0 });
  };

  const goSignup = () => countTrial('cta');

  if (stage === 'writing') {
    return (
      <DictationSession
        // 문장이 바뀌면 화면을 새로 시작합니다. 앞 문장의 입력·채점이 남으면 안 됩니다.
        key={current.id}
        items={[{ refId: current.sentence, sentence: current.sentence }]}
        mode="practice"
        title={`한 문장 써 보기 · ${index + 1} / ${DEMO_SENTENCES.length}`}
        settings={DEFAULT_SETTINGS}
        speechProvider={demoSpeech}
        trial
        onComplete={(outcomes) => {
          if (!finished.current) {
            finished.current = true;
            countTrial('finish');
          }
          setLastCorrect(outcomes[0]?.correct ?? null);
          setStage('after');
          window.scrollTo({ top: 0 });
        }}
        onExit={() => setStage(lastCorrect === null ? 'intro' : 'after')}
      />
    );
  }

  const signupButtons = (
    <div className="flex flex-col gap-2">
      <Link href="/login?start=signup" onClick={goSignup} className="btn btn-primary btn-lg text-center">
        가입하고 시작하기
      </Link>
      <Link
        href="/login"
        onClick={goSignup}
        className="py-2 text-center text-sm underline underline-offset-4"
        style={{ color: 'var(--ink-soft)' }}
      >
        이미 계정이 있어요 · 로그인
      </Link>
      <p className="text-center text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
        {FREE_NOTE}
      </p>
    </div>
  );

  if (stage === 'after') {
    return (
      <main className="page page--write" style={{ paddingBottom: 48 }}>
        <header className="pb-4 pt-8">
          <h1 className="display text-2xl font-bold">
            {lastCorrect ? '다 맞게 쓰셨어요' : '틀린 곳을 한 글자씩 짚어 줬어요'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {lastCorrect
              ? '어른은 대개 다 맞혀요. 아이들은 같은 문장을 이렇게 써요 — 그럴 때 이렇게 짚어 줘요.'
              : '아이도 똑같이 받아요. 틀린 문장은 오답노트에 모였다가, 두 번 잇달아 맞히면 졸업해요.'}
          </p>
        </header>

        {/* 어른은 거의 다 맞히므로 빨간 펜이 보이는 채점표를 하나 더 보여 줍니다 */}
        <section className="mb-6">
          <h2 className="section-title mb-2">아이들은 이렇게 많이 틀려요</h2>
          <p className="mb-3 text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>
            「{DEMO_MISTAKE.written}」라고 쓴 아이의 채점표예요. 모음, 띄어쓰기, 받침을 따로 짚어요.
          </p>
          <GradeSheet result={mistake} writeMode="wongoji" />
        </section>

        <HowItWorks />

        <section className="surface mb-4 p-5">{signupButtons}</section>

        {hasMore && (
          <button
            onClick={() => {
              setIndex((i) => i + 1);
              begin();
            }}
            className="btn btn-secondary w-full"
          >
            한 문장 더 해 보기 ({index + 2} / {DEMO_SENTENCES.length})
          </button>
        )}

        <LegalLinks />
      </main>
    );
  }

  return (
    <main className="page" style={{ paddingBottom: 48 }}>
      <header className="pb-6 pt-12 text-center">
        <div className="mb-6" aria-hidden>
          <WongojiSheet cells={padToGrid(toCells('받아쓰기 공책'), 1)} fill label="받아쓰기 공책" />
        </div>
        <h1 className="display text-[26px] font-bold leading-snug">
          오늘 밤 받아쓰기 불러 주기,
          <br />
          이제 안 하셔도 돼요
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          아이가 혼자 듣고, 원고지에 쓰고,
          <br />
          틀린 곳을 한 글자씩 짚어 받아요.
        </p>
      </header>

      <button onClick={begin} className="btn btn-primary btn-lg w-full" style={{ fontSize: 18 }}>
        🔊 한 문장 써 보기
      </button>
      <p className="mb-8 mt-2 text-center text-[12px]" style={{ color: 'var(--ink-faint)' }}>
        가입 없이 바로 돼요 · 소리가 나요
      </p>

      <HowItWorks />

      <p className="text-center text-sm">
        <Link href="/login" className="underline underline-offset-4" style={{ color: 'var(--ink-soft)' }}>
          이미 계정이 있어요 · 로그인
        </Link>
      </p>

      <LegalLinks />
    </main>
  );
}

/**
 * 가입한 뒤 무엇을 하게 되는지. 체험 문장은 우리가 고른 것이라,
 * 「우리 아이 학교 급수표로도 되나?」가 바로 다음 물음입니다.
 */
function HowItWorks() {
  const steps = [
    { icon: '📷', title: '급수표를 사진으로', body: '학교에서 받은 받아쓰기 급수표를 찍으면 문장이 들어가요.' },
    { icon: '✏️', title: '문장만 확인', body: '잘못 읽힌 글자가 없는지 한 번 봐 주세요.' },
    { icon: '🎧', title: '아이 혼자 받아쓰기', body: '듣고 쓰고 채점까지. 매일 밤 불러 주지 않아도 돼요.' },
  ];
  return (
    <section className="mb-6">
      <h2 className="section-title mb-2">우리 아이 학교 급수표로 하려면</h2>
      <ol className="surface divide-y" style={{ borderColor: 'var(--rule)' }}>
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 p-4">
            <span className="text-xl" aria-hidden>
              {s.icon}
            </span>
            <div>
              <p className="text-[15px] font-bold">
                {i + 1}. {s.title}
              </p>
              <p className="mt-0.5 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LegalLinks() {
  return (
    <p className="mt-8 text-center text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
      <Link href="/terms" className="underline underline-offset-2">
        이용약관
      </Link>
      {' · '}
      <Link href="/privacy" className="underline underline-offset-2">
        개인정보처리방침
      </Link>
    </p>
  );
}
