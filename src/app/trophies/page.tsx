import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { listTrophies } from '@/lib/data';
import { readActiveProfile } from '@/lib/profile-server';
import { formatSeoulDate } from '@/lib/review';

export const metadata = { title: '보관함 · 받아쓰기 공책' };

/**
 * 보관함 — 지금까지 모은 카드와 배지.
 *
 * 금색을 쓰는 두 번째 자리입니다(결과 화면과 여기).
 * 모아둔 것이 눈에 보여야 다음 시험을 끝까지 마칠 이유가 생깁니다.
 */
export default async function TrophiesPage() {
  const { child } = await readActiveProfile();
  const trophies = child ? await listTrophies(child.id) : [];

  const gold = trophies.filter((t) => t.kind === 'gold').length;
  const silver = trophies.length - gold;

  return (
    <main className="page">
      <header className="mb-5 pt-4">
        <h1 className="display text-2xl font-bold">보관함</h1>
        {child && (
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            <span aria-hidden="true">{child.avatar} </span>
            {child.nickname} · 카드 {gold}장 · 배지 {silver}개
          </p>
        )}
      </header>

      {!child ? (
        <EmptyState
          title="누구의 보관함을 볼까요"
          description="프로필을 고르면 그 아이가 모은 카드가 보여요."
          action={
            <Link href="/children" className="btn btn-secondary">
              프로필 바꾸기
            </Link>
          }
        />
      ) : trophies.length === 0 ? (
        <EmptyState
          title="아직 모은 것이 없어요"
          description="시험을 끝까지 마치고 90점을 넘기면 배지를, 100점이면 카드를 받아요."
          action={
            <Link href="/dictation" className="btn btn-primary">
              받아쓰기 시험 보기
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {trophies.map((trophy) => (
            <li
              key={trophy.id}
              className="flex flex-col items-center gap-1.5 rounded p-4 text-center"
              style={{
                background: trophy.kind === 'gold' ? 'var(--gold-tint)' : 'var(--card)',
                border: `1.5px solid ${trophy.kind === 'gold' ? 'var(--gold)' : 'var(--rule-strong)'}`,
                borderRadius: 'var(--radius)',
              }}
            >
              <span className="text-[40px] leading-none" aria-hidden="true">
                {trophy.emblem}
              </span>
              <span
                className="display text-sm font-bold"
                style={{ color: trophy.kind === 'gold' ? '#6d520c' : 'var(--ink)' }}
              >
                {trophy.kind === 'gold' ? '100점 카드' : '배지'}
              </span>
              {trophy.label && (
                <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                  {trophy.label}
                </span>
              )}
              <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                {formatSeoulDate(trophy.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
