import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChildForm } from '@/components/ChildForm';
import { getChild } from '@/lib/profile-server';

/** 프로필 고치기. 남의 가족 프로필은 RLS에 걸려 조회되지 않으므로 곧바로 404가 됩니다. */
export default async function EditChildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const child = await getChild(id);
  if (!child) notFound();

  return (
    <main className="page">
      <header className="pb-5 pt-8">
        <Link href="/children" className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          ← 프로필 선택
        </Link>
        <h1 className="display mt-3 text-2xl font-bold">
          <span aria-hidden="true">{child.avatar} </span>
          {child.nickname}
        </h1>
      </header>

      <ChildForm initial={child} />
    </main>
  );
}
