'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sfx } from '@/lib/sfx';
import type { CompleteSessionResponse } from '@/lib/session';
import type { Mode } from '@/lib/types';

/**
 * 세션을 끝까지 마친 뒤에만 나오는 화면.
 *
 * 이 앱에서 금색이 나오는 유일한 자리입니다(디자인 규칙).
 * 도중에 축하 연출을 넣지 않는 이유와 같은 이유로,
 * 여기서는 아낌없이 보여 줍니다. 드물어야 값이 있습니다.
 */
export function SessionResult({
  result,
  mode,
  title,
  wrongItems,
  retryHref,
  listHref,
  trophyHref = '/trophies',
}: {
  result: CompleteSessionResponse;
  mode: Mode;
  title: string;
  /** 다시 볼 문장·문제 (틀린 것) */
  wrongItems: string[];
  retryHref: string;
  listHref: string;
  trophyHref?: string;
}) {
  const { trophy } = result;

  useEffect(() => {
    if (trophy) sfx.reward();
    else if (result.starsEarned > 0) sfx.star();
  }, [trophy, result.starsEarned]);

  // "한 번 더 풀기"는 대개 방금 있던 그 주소로 돌아갑니다.
  // <Link>는 지금 주소와 똑같은 href로는 이동을 시작하지 않아 눌러도 반응이 없었습니다.
  // 뒤에 매번 다른 값을 붙여 주소를 살짝 다르게 만들어야 새 세션으로 이어집니다.
  const [retryNonce] = useState(() => Date.now());
  const freshRetryHref = `${retryHref}${retryHref.includes('?') ? '&' : '?'}r=${retryNonce}`;

  return (
    <div className="page">
      <header className="pb-5 pt-8 text-center">
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          {title} · {mode === 'exam' ? '시험' : '연습'}을 끝냈어요
        </p>
        <p
          className="display mt-2 text-[54px] font-bold leading-none"
          style={{ color: 'var(--grid-deep)' }}
        >
          {result.score}
          <span className="text-2xl">점</span>
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {result.totalCount}문제 중 {result.correctCount}문제를 맞혔어요
        </p>
      </header>

      {trophy && (
        <section
          className="stamp-in mb-5 flex flex-col items-center gap-2 rounded p-6 text-center"
          style={{ background: 'var(--gold-tint)', border: '2px solid var(--gold)' }}
        >
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-[44px]"
            style={{ background: '#fff', border: `3px solid var(--gold)` }}
            aria-hidden="true"
          >
            {trophy.emblem}
          </div>
          <p className="display text-lg font-bold" style={{ color: '#6d520c' }}>
            {trophy.kind === 'gold' ? '100점 카드를 받았어요!' : '배지를 받았어요!'}
          </p>
          {trophy.label && (
            <p className="text-sm" style={{ color: '#6d520c' }}>
              {trophy.label}
            </p>
          )}
          <Link
            href={trophyHref}
            className="btn mt-1"
            style={{ background: 'var(--gold)', color: '#fff' }}
          >
            보관함에서 보기
          </Link>
        </section>
      )}

      {mode === 'exam' && !trophy && (
        <p
          className="mb-5 rounded-sm p-3 text-center text-sm"
          style={{ background: 'var(--paper-sunk)', color: 'var(--ink-soft)' }}
        >
          90점을 넘기면 배지를, 100점이면 카드를 받아요.
        </p>
      )}

      {(result.starsEarned > 0 || result.graduated > 0 || result.added > 0) && (
        <section className="surface mb-5 flex flex-col gap-1.5 p-4 text-sm">
          {result.starsEarned > 0 && (
            <p>
              별 <b style={{ color: 'var(--gold)' }}>{result.starsEarned}개</b>를 받았어요.
            </p>
          )}
          {result.graduated > 0 && (
            <p>
              <b>{result.graduated}개</b> 문제가 오답노트를 졸업했어요.
            </p>
          )}
          {result.added > 0 && (
            <p style={{ color: 'var(--ink-soft)' }}>
              틀린 {result.added}개는 오답노트에 담아 두었어요.
            </p>
          )}
        </section>
      )}

      {wrongItems.length > 0 && (
        <>
          <h2 className="section-title mb-2">다시 볼 것</h2>
          <ul className="surface mb-5 flex flex-col gap-2 p-4">
            {wrongItems.map((item, i) => (
              <li key={i} className="text-sm" style={{ color: 'var(--ink)' }}>
                · {item}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-col gap-2">
        <Link href={freshRetryHref} className="btn btn-primary btn-lg">
          한 번 더 풀기
        </Link>
        <Link href="/notes" className="btn btn-secondary btn-lg">
          오답노트 보기
        </Link>
        <Link href={listHref} className="btn btn-quiet w-full justify-center">
          목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
