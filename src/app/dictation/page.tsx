import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { DICTATION_BANK } from '@/data/dictation-bank';
import { builtinBestScores, listSets } from '@/lib/data';
import { readActiveProfile } from '@/lib/profile-server';

/**
 * 받아쓰기 — 세트 목록.
 *
 * 기본 문제를 위에 둡니다.
 * 부모가 아직 아무것도 넣지 않았어도 아이가 오늘 할 게 있어야 하기 때문입니다.
 * 학년·학기 표시 없이 급수 1~10으로만 올라갑니다(난이도만 있는 목록).
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
            ? '기본 문제가 들어 있고, 학교 문제지도 넣을 수 있어요'
            : '풀고 싶은 것을 골라 보세요'}
        </p>
      </header>

      <h2 className="section-title mb-2">기본 문제</h2>
      <p className="mb-2.5 text-xs" style={{ color: 'var(--ink-faint)' }}>
        급수가 올라갈수록 어려워져요. 낮은 급부터 차례로 해 보세요.
      </p>

      <ul className="mb-6 flex flex-col gap-2">
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

      <h2 className="section-title mb-2">직접 넣은 문제</h2>
      {sets.length === 0 ? (
        <EmptyState
          title="아직 넣은 문제가 없어요"
          description={
            isParent
              ? '학교에서 받아온 문제지를 사진으로 찍거나 직접 입력해서 넣어 주세요.'
              : '보호자 화면에서 문제를 넣으면 여기에 나타나요. 그때까지는 기본 문제로 연습해요.'
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
    </main>
  );
}
