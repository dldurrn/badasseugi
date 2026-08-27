import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SetForm } from '@/components/SetForm';
import { EmptyState } from '@/components/EmptyState';
import { getSet } from '@/lib/data';
import { readActiveProfile } from '@/lib/profile-server';
import { suggestSetName } from '@/lib/sets';

/** 문제 세트 고치기 — 보호자 화면 전용. */
export default async function EditSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const set = await getSet(id);
  if (!set) notFound();

  const { view } = await readActiveProfile();

  return (
    <main className="page">
      <header className="pb-5 pt-8">
        <Link href={`/dictation/${set.id}`} className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          ← {set.name}
        </Link>
        <h1 className="display mt-3 text-2xl font-bold">문제 세트 고치기</h1>
      </header>

      {view === 'parent' ? (
        <SetForm defaultName={suggestSetName()} initial={set} />
      ) : (
        <EmptyState
          title="보호자 화면에서 고칠 수 있어요"
          description="문제를 고치는 일은 어른이 해요."
          action={
            <Link href="/children" className="btn btn-secondary">
              프로필 바꾸기
            </Link>
          }
        />
      )}
    </main>
  );
}
