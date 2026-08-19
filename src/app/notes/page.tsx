import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { NoteItem } from '@/components/NoteItem';
import { Stars } from '@/components/Stars';
import { SPELLING_BANK } from '@/data/spelling-bank';
import { listWrongNotes } from '@/lib/data';
import { readActiveProfile } from '@/lib/profile-server';
import { isGraduated } from '@/lib/review';

/**
 * 오답노트 — 받아쓰기와 맞춤법을 한 곳에서.
 *
 * 항목을 그 자리에서 바로 풀 수 있습니다.
 * 여러 개를 몰아서 풀고 싶으면 위쪽 '이어서 풀기'로 세션에 들어갑니다.
 */
export default async function NotesPage() {
  const { view, child } = await readActiveProfile();
  const isChild = view === 'child';

  const notes = child ? await listWrongNotes(child.id) : [];
  const active = notes.filter((n) => !isGraduated(n));
  const graduated = notes.filter(isGraduated);

  // 맞춤법 오답은 문제은행에서 원래 문제를 찾아야 그 자리에서 풀 수 있습니다.
  const questionFor = (refId: string) => SPELLING_BANK.find((q) => q.id === refId);

  const countIn = (module: 'dictation' | 'spelling') =>
    active.filter((n) => n.module === module).length;

  return (
    <main className="page">
      <header className="mb-4 pt-4">
        <h1 className="display text-2xl font-bold">오답노트</h1>
        {child && (
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            <span aria-hidden="true">{child.avatar} </span>
            {child.nickname}
          </p>
        )}
      </header>

      {/* 규칙을 글이 아니라 별로 먼저 보여줍니다 */}
      <div
        className="mb-5 flex items-center gap-3 rounded p-4"
        style={{ background: 'var(--gold-tint)', border: '1px solid var(--gold)' }}
      >
        <Stars streak={2} size={24} />
        <p className="flex-1 text-[13px] leading-relaxed" style={{ color: '#6d520c' }}>
          별 두 개를 모으면 졸업이에요.
          <br />
          <b>두 번 연속</b> 맞히면 돼요. 한 번이라도 틀리면 처음부터예요.
        </p>
      </div>

      {!child ? (
        <EmptyState
          title="누구의 오답노트를 볼까요"
          description="프로필을 고르면 그 아이가 틀린 문제가 모여 있어요."
          action={
            <Link href="/children" className="btn btn-secondary">
              프로필 고르기
            </Link>
          }
        />
      ) : active.length === 0 ? (
        <EmptyState
          title="지금 연습할 오답이 없어요"
          description="받아쓰기나 맞춤법에서 틀린 문제가 여기에 모여요."
          action={
            isChild ? (
              <Link href="/dictation" className="btn btn-secondary">
                받아쓰기 하러 가기
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {isChild && (
            <div className="mb-5 flex flex-col gap-2">
              {(['dictation', 'spelling'] as const).map((module) => {
                const count = countIn(module);
                if (count === 0) return null;
                return (
                  <Link
                    key={module}
                    href={`/notes/practice?module=${module}`}
                    className="surface flex items-center gap-3 p-4"
                  >
                    <div className="flex-1">
                      <span className="display block text-base font-bold">
                        {module === 'dictation' ? '받아쓰기' : '맞춤법'} 오답 이어서 풀기
                      </span>
                      <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
                        {count}개를 한 번에 풀어요
                      </span>
                    </div>
                    <span aria-hidden="true" style={{ color: 'var(--ink-faint)' }}>
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          <h2 className="section-title mb-2">모으는 중 ({active.length})</h2>
          <ul className="mb-6 flex flex-col gap-2.5">
            {active.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                question={note.module === 'spelling' ? questionFor(note.refId) : undefined}
                childId={isChild && child ? child.id : null}
              />
            ))}
          </ul>

          {graduated.length > 0 && (
            <>
              <h2 className="section-title mb-2">졸업 ({graduated.length})</h2>
              <ul className="flex flex-col gap-2">
                {graduated.map((note) => (
                  <li
                    key={note.id}
                    className="surface flex items-center gap-3 p-3 text-sm"
                    style={{ color: 'var(--ink-soft)' }}
                  >
                    <Stars streak={2} size={16} />
                    <span className="flex-1">{note.content}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}
