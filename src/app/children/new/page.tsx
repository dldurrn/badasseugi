import Link from 'next/link';
import { ChildForm } from '@/components/ChildForm';
import { EmptyState } from '@/components/EmptyState';
import { MAX_CHILDREN } from '@/lib/profile';
import { listChildren } from '@/lib/profile-server';

/** 프로필 만들기. 상한에 닿으면 만들 수 없는 이유와 다음 행동을 함께 보여 줍니다. */
export default async function NewChildPage() {
  const profiles = await listChildren();
  const full = profiles.length >= MAX_CHILDREN;

  return (
    <main className="page">
      <header className="pb-5 pt-8">
        <Link href="/children" className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          ← 프로필 선택
        </Link>
        <h1 className="display mt-3 text-2xl font-bold">프로필 만들기</h1>
      </header>

      {full ? (
        <EmptyState
          title={`프로필은 ${MAX_CHILDREN}개까지예요`}
          description="쓰지 않는 프로필을 지우면 새로 만들 수 있어요."
          action={
            <Link href="/settings" className="btn btn-secondary">
              프로필 정리하기
            </Link>
          }
        />
      ) : (
        <ChildForm />
      )}
    </main>
  );
}
