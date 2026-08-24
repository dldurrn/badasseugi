import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { DICTATION_BANK } from '@/data/dictation-bank';
import { builtinBestScores, listSets } from '@/lib/data';
import { readActiveProfile } from '@/lib/profile-server';

/**
 * 받아쓰기 — 세트 목록.
 *
 * 직접 넣은 문제를 위에 둡니다.
 * 학교에서 받아온 문제지가 오늘 풀어야 할 것이고, 연습 문제는 그 사이를 메우는 것이라
 * 진짜 할 일이 먼저 보여야 합니다.
 * 아직 넣은 게 없으면 빈 안내가 위에 오는데, 그게 곧 "여기에 넣으세요"라는 말이 됩니다.
 *
 * 연습 문제는 학년·학기 표시 없이 급수 1~20으로만 올라갑니다(난이도만 있는 목록).
 * 만들기는 보호자 화면에만 보입니다(지침 9).
 */
export default async function DictationPage() {
  const { view, child } = await readActiveProfile();
  const isParent = view === 'parent';
  const childId = view === 'child' ? (child?.id ?? null) : null;

  const [sets, builtinBest] = await Promise.all([
    listSets(childId),
    builtinBestScores(childId),
  ]);

  return (
    <main className="page">
      <header className="mb-5 pt-4">
        <h1 className="display text-2xl font-bold">받아쓰기</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {isParent
            ? '학교 문제지를 넣을 수 있고, 연습 문제도 들어 있어요'
            : '풀고 싶은 것을 골라 보세요'}
        </p>
      </header>

      <h2 className="section-title mb-2">직접 넣은 문제</h2>
      {sets.length === 0 ? (
        <EmptyState
          title="아직 넣은 문제가 없어요"
          description={
            isParent
              ? '학교에서 받아온 문제지를 사진으로 찍거나 직접 입력해서 넣어 주세요.'
              : '보호자 화면에서 문제를 넣으면 여기에 나타나요. 그때까지는 연습 문제로 해 보세요.'
          }
          action={
            isParent ? (
              <Link href="/dictation/new" className="btn btn-primary mt-1">
                문제 세트 만들기
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {sets.map((set) => (
            <li key={set.id}>
              <Link href={`/dictation/${set.id}`} className="surface block p-4">
                <span className="display text-lg font-bold">{set.name}</span>
                <span className="mt-1 block text-xs" style={{ color: 'var(--ink-soft)' }}>
                  문장 {set.count}개
                  {set.best !== null && ` · 최고 ${set.best}점`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isParent && sets.length > 0 && (
        <Link href="/dictation/new" className="btn btn-secondary btn-lg mt-4">
          문제 세트 만들기
        </Link>
      )}

      <h2 className="section-title mb-2 mt-8">연습 문제</h2>
      <p className="mb-2.5 text-xs" style={{ color: 'var(--ink-faint)' }}>
        급수가 올라갈수록 어려워져요. 낮은 급부터 차례로 해 보세요.
      </p>

      <ul className="flex flex-col gap-2">
        {DICTATION_BANK.map((set) => {
          const best = builtinBest.get(set.id);
          return (
            <li key={set.id}>
              <Link href={`/dictation/${set.id}`} className="surface block p-4">
                <span className="display text-base font-bold">{set.name}</span>
                <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
                  {set.focus} · {set.sentences.length}개
                  {best !== undefined && ` · 최고 ${best}점`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
