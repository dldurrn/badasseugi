'use client';

import { useEffect, useState } from 'react';

/**
 * 처음 온 사람에게 무엇부터 하면 되는지 알려 줍니다.
 *
 * 부모와 아이가 할 일이 완전히 달라서 내용을 나눕니다.
 * - 부모: 문제를 넣고 → 아이에게 넘기고 → 리포트로 확인
 * - 아이: 듣고 쓰고 → 끝까지 마치고 → 틀린 건 오답노트에서
 *
 * 본 사람에게 계속 보이면 잔소리가 되므로 한 번 닫으면 다시 뜨지 않습니다.
 * 소리·속도 설정과 같은 방식으로 기기에 기억합니다(localStorage).
 * 아이 태블릿과 부모 폰이 따로인 경우가 많아, 기기별로 기억하는 편이
 * 오히려 각자 한 번씩 보게 되어 맞습니다.
 *
 * 더보기의 "사용법 다시 보기"에서 언제든 다시 열 수 있습니다.
 */

const STORAGE_PREFIX = 'badasseugi:onboarded:';

interface Step {
  title: string;
  body: string;
}

const PARENT_STEPS: Step[] = [
  {
    title: '문제를 넣어요',
    body: '받아쓰기 탭에서 세트를 만들어요. 학교 문제지를 사진으로 찍거나 직접 입력하면 돼요. 사진은 잘못 읽힐 수 있으니 글자를 꼭 확인해 주세요.',
  },
  {
    title: '연습 문제도 있어요',
    body: '아무것도 넣지 않아도 1급부터 20급까지 이미 들어 있어요. 목록에서 직접 넣은 문제 아래에 있고, 급수가 올라갈수록 어려워져요.',
  },
  {
    title: '아이에게 넘겨요',
    body: '더보기 > 프로필 고르기에서 아이 얼굴을 누르면 아이 화면이 돼요. 아이 화면에서는 문제 만들기와 리포트가 보이지 않아요.',
  },
  {
    title: '정답이 안 보이게 잠가요',
    body: '설정 > 보호자 잠금에 비밀번호를 걸면, 아이가 보호자 화면으로 넘어와 정답 문장을 미리 보는 걸 막을 수 있어요.',
  },
  {
    title: '리포트로 확인해요',
    body: '아이가 받침을 자주 틀리는지 띄어쓰기를 자주 틀리는지 한눈에 볼 수 있어요.',
  },
];

const CHILD_STEPS: Step[] = [
  {
    title: '잘 듣고 써요',
    body: '받아쓰기에서 문제를 골라요. 잘 안 들리면 "또박또박 듣기"를 눌러 보세요. 낱말마다 쉬어서 읽어 줘요.',
  },
  {
    title: '원고지 칸에 써요',
    body: '학교 공책처럼 칸마다 한 글자씩 써요. 띄어쓰기도 한 칸이에요. 한 줄에 이어서 쓰고 싶으면 "그냥 쓰기"를 누르면 돼요.',
  },
  {
    title: '쓰고 나서 한 번 더 봐요',
    body: '"확인"을 누르면 내가 쓴 것을 보여줘요. 고칠 게 있으면 "다시 고치기", 괜찮으면 "제출하기"를 눌러요.',
  },
  {
    title: '끝까지 해야 기록돼요',
    body: '중간에 나가면 점수와 별이 남지 않아요. 시작했으면 끝까지 해 보아요.',
  },
  {
    title: '틀린 건 오답노트에서',
    body: '틀린 문제가 오답노트에 모여요. 두 번 연속 맞히면 별 두 개를 받고 졸업이에요. 한 번이라도 틀리면 처음부터예요.',
  },
  {
    title: '시험을 끝내면 상을 받아요',
    body: '시험을 끝까지 마치고 90점을 넘기면 배지를, 100점이면 카드를 받아요. 보관함에서 모은 걸 볼 수 있어요.',
  },
];

export function Onboarding({ isParent }: { isParent: boolean }) {
  // 서버에서 그릴 때는 localStorage를 읽을 수 없어, 뜬 뒤에 판단합니다.
  // 그전에 잠깐 보였다 사라지면 깜빡이므로 아예 아무것도 그리지 않습니다.
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  const key = `${STORAGE_PREFIX}${isParent ? 'parent' : 'child'}`;
  const steps = isParent ? PARENT_STEPS : CHILD_STEPS;
  const last = step === steps.length - 1;

  useEffect(() => {
    setShow(window.localStorage.getItem(key) !== '1');
    setReady(true);
  }, [key]);

  const dismiss = () => {
    window.localStorage.setItem(key, '1');
    setShow(false);
  };

  const back = () => setStep((s) => Math.max(0, s - 1));
  const forward = () => {
    if (last) dismiss();
    else setStep((s) => s + 1);
  };

  // 화살표로도 넘길 수 있게 합니다. 버튼만 두면 키보드로 읽는 사람이 번거롭습니다.
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') back();
      if (e.key === 'ArrowRight') setStep((s) => Math.min(steps.length - 1, s + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, steps.length]);

  if (!ready || !show) return null;

  const current = steps[step];

  return (
    <section
      className="rise-in mb-6 rounded p-5"
      style={{ background: 'var(--card)', border: `2px solid var(--grid)` }}
      aria-labelledby="onboarding-title"
    >
      <h2
        id="onboarding-title"
        className="display text-lg font-bold"
        style={{ color: 'var(--grid-deep)', margin: 0 }}
      >
        {isParent ? '처음이시죠? 이렇게 쓰면 돼요' : '이렇게 하면 돼요'}
      </h2>

      {/* 지금 어디쯤인지 — 몇 걸음 남았는지 보여야 건너뛰지 않습니다 */}
      <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
        {steps.map((s, i) => (
          <span
            key={s.title}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === step ? 18 : 6,
              background: i <= step ? 'var(--grid)' : 'var(--rule-strong)',
            }}
          />
        ))}
      </div>

      {/*
        걸음마다 글 길이가 달라 카드 높이가 출렁이면 아래 내용이 튑니다.
        가장 긴 걸음에 맞춰 자리를 잡아 둡니다.
      */}
      <div className="mt-4" style={{ minHeight: 104 }} role="status" aria-live="polite">
        <p className="text-[15px] font-semibold" style={{ margin: 0 }}>
          {current.title}
        </p>
        <p
          className="mt-1 text-[13.5px] leading-relaxed"
          style={{ color: 'var(--ink-soft)', margin: '4px 0 0' }}
        >
          {current.body}
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        {step > 0 && (
          <button className="btn btn-secondary" onClick={back}>
            이전
          </button>
        )}
        <button className="btn btn-primary flex-1 justify-center" onClick={forward}>
          {last ? (isParent ? '알겠어요, 시작할게요' : '알겠어요!') : '다음'}
        </button>
      </div>

      {/* 끝까지 다섯 번 누르게 강제하지 않습니다 */}
      {!last && (
        <button
          className="btn btn-quiet mt-1 w-full justify-center text-xs"
          onClick={dismiss}
        >
          건너뛰기
        </button>
      )}

      <p className="mt-2 text-center text-xs" style={{ color: 'var(--ink-faint)' }}>
        더보기에서 언제든 다시 볼 수 있어요
      </p>
    </section>
  );
}

/** 더보기의 "사용법 다시 보기"가 부릅니다. */
export function resetOnboarding(): void {
  window.localStorage.removeItem(`${STORAGE_PREFIX}parent`);
  window.localStorage.removeItem(`${STORAGE_PREFIX}child`);
}
