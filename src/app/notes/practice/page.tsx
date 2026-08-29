import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DictationRunner } from '@/components/DictationRunner';
import { SpellingRunner } from '@/components/SpellingRunner';
import { EmptyState } from '@/components/EmptyState';
import { SPELLING_BANK } from '@/data/spelling-bank';
import { listWrongNotes } from '@/lib/data';
import { readActiveChild } from '@/lib/profile-server';
import { readSettings } from '@/lib/settings-server';
import { isGraduated, type WrongNote } from '@/lib/review';
import { stepOf } from '@/lib/twin';
import type { Module } from '@/lib/types';

export const metadata = { title: '오답 이어서 풀기 · 받아쓰기 공책' };

/**
 * 오답 여러 개를 몰아서 푸는 자리.
 *
 * 하나씩 푸는 것은 오답노트 목록에서 그 자리에 펼쳐서 합니다.
 * 여기는 "쌓인 것을 한 번에 치우고 싶다"는 경우를 위한 길입니다.
 *
 * 언제나 연습 모드입니다. 여기서 받는 것은 별이지 배지가 아닙니다(절대 원칙 1).
 */

const PER_SESSION = 10;

function pickPool(notes: WrongNote[]): WrongNote[] {
  // 날짜로 별을 막지 않으므로 아직 졸업하지 않은 것을 그대로 내보냅니다.
  return notes.filter((n) => !isGraduated(n)).slice(0, PER_SESSION);
}

export default async function NotesPracticePage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; r?: string }>;
}) {
  const { module: rawModule, r } = await searchParams;
  const module: Module = rawModule === 'spelling' ? 'spelling' : 'dictation';

  const [child, settings] = await Promise.all([readActiveChild(), readSettings()]);
  if (!child) redirect('/children');

  const pool = pickPool(await listWrongNotes(child.id, module));

  // 별 안내를 만들려면 지금 몇 개를 모았는지 알아야 합니다.
  const starNotes = Object.fromEntries(
    pool.map((n) => [n.refId, { streak: n.streak, lastCorrectDate: n.lastCorrectDate }]),
  );

  const empty = (
    <main className="page">
      <header className="pb-5 pt-8">
        <Link href="/notes" className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          ← 오답노트
        </Link>
      </header>
      <EmptyState
        title="지금 연습할 문제가 없어요"
        description="틀린 문제가 생기면 여기에서 다시 풀 수 있어요."
        action={
          <Link href={module === 'spelling' ? '/spelling' : '/dictation'} className="btn btn-secondary">
            {module === 'spelling' ? '맞춤법 풀러 가기' : '받아쓰기 하러 가기'}
          </Link>
        }
      />
    </main>
  );

  if (pool.length === 0) return empty;

  /*
    별을 하나 받아 둔 문제에는 **원본 대신 짝**을 냅니다.

    여기서도 두 번째는 다른 문제여야 합니다 — 같은 것을 두 번 내면
    찍기는 걸러도 암기는 못 거릅니다(절대 원칙 5가 적어 둔 목적).
    몰아 푸는 자리라 한 문제를 두 걸음 이어 풀지는 않습니다.
    원본을 맞히면 별 하나를 받고, 짝은 **다음 판에** 나옵니다.
  */
  const 낼것 = (n: WrongNote) => stepOf(n);

  if (module === 'spelling') {
    // 문제은행에서 사라진 문제(id 변경 등)는 낼 수 없으니 걸러 냅니다.
    const questions = pool
      .map((n) => {
        const ref = 낼것(n) === 'twin' && n.twinRef ? n.twinRef : n.refId;
        const q = SPELLING_BANK.find((x) => x.id === ref);
        if (!q) return null;
        // 짝을 낼 때도 기록은 원본의 id 로 남깁니다.
        return ref === n.refId ? q : { ...q, originRefId: n.refId };
      })
      .filter((q): q is NonNullable<typeof q> => Boolean(q));

    if (questions.length === 0) return empty;

    return (
      <SpellingRunner
        /* "한 번 더 풀기"가 붙이는 r 값이 바뀌어야 새 세션으로 다시 만들어집니다. */
        key={`notes-spelling-${r ?? 'first'}`}
        childId={child.id}
        questions={questions}
        kind={null}
        kindLabel="맞춤법 오답 연습"
        mode="practice"
        listHref="/notes"
        retryHref="/notes/practice?module=spelling"
        starNotes={starNotes}
      />
    );
  }

  return (
    <DictationRunner
      /* "한 번 더 풀기"가 붙이는 r 값이 바뀌어야 새 세션으로 다시 만들어집니다. */
      key={`notes-dictation-${r ?? 'first'}`}
      childId={child.id}
      settings={settings.effective}
      items={pool.map((n) => {
        const twin = 낼것(n) === 'twin' && n.twinRef;
        // refId 는 언제나 원본입니다. 화면에 내는 문장만 갈립니다.
        return { refId: n.refId, sentence: twin ? n.twinRef! : n.content, isTwin: Boolean(twin) };
      })}
      mode="practice"
      title="받아쓰기 오답 연습"
      setId={null}
      listHref="/notes"
      retryHref="/notes/practice?module=dictation"
      starNotes={starNotes}
    />
  );
}
