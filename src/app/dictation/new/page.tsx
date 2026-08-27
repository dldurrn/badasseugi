import Link from 'next/link';
import { SetForm } from '@/components/SetForm';
import { EmptyState } from '@/components/EmptyState';
import { readActiveProfile } from '@/lib/profile-server';
import { suggestSetName } from '@/lib/sets';

export const metadata = { title: '문제 세트 만들기 · 받아쓰기 공책' };

/** 세트 만들기 — 보호자 화면 전용. */
export default async function NewSetPage() {
  const { view } = await readActiveProfile();

  return (
    <main className="page">
      <header className="pb-5 pt-8">
        <Link href="/dictation" className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          ← 받아쓰기
        </Link>
        <h1 className="display mt-3 text-2xl font-bold">문제 세트 만들기</h1>
      </header>

      {view === 'parent' ? (
        <SetForm defaultName={suggestSetName()} />
      ) : (
        <EmptyState
          title="보호자 화면에서 만들 수 있어요"
          description="문제 세트 만들기는 어른이 하는 일이에요. 프로필을 바꾸면 만들 수 있어요."
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
