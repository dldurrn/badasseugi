import Link from 'next/link';
import { ShowGuideAgain } from '@/components/ShowGuideAgain';
import { readActiveProfile } from '@/lib/profile-server';

export const metadata = { title: '더보기 · 받아쓰기 공책' };

/**
 * 더보기 — 리포트와 설정 묶음.
 *
 * 리포트는 아이가 볼 화면이 아니라, 자녀 화면에서는 항목 자체를 감춥니다(지침 9).
 */
export default async function MorePage() {
  const { view, child } = await readActiveProfile();
  const isParent = view === 'parent';

  const items = [
    ...(isParent
      ? [{ href: '/report', name: '리포트', description: '아이가 무엇을 어려워하는지 봐요' }]
      : []),
    {
      href: '/trophies',
      name: '보관함',
      description: '지금까지 모은 카드와 배지를 봐요',
    },
    {
      href: '/settings',
      name: '설정',
      description: isParent
        ? '아이가 푸는 방식, 자녀 프로필, 계정'
        : '소리와 목소리, 쓰는 방법',
    },
    {
      href: '/children',
      name: '프로필 바꾸기',
      description: isParent ? '아이 화면으로 들어가요' : '다른 사람이 쓸 때 눌러요',
    },
    {
      href: '/privacy',
      name: '개인정보처리방침',
      description: '어떤 정보를 다루는지 적어 두었어요',
    },
  ];

  return (
    <main className="page">
      <header className="mb-5 pt-4">
        <h1 className="display text-2xl font-bold">더보기</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {isParent ? '보호자 화면이에요' : child ? `${child.avatar} ${child.nickname}` : null}
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="surface flex items-center gap-4 p-4">
              <div className="flex-1">
                <span className="display block text-base font-bold">{item.name}</span>
                <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
                  {item.description}
                </span>
              </div>
              <span aria-hidden="true" style={{ color: 'var(--ink-faint)' }}>→</span>
            </Link>
          </li>
        ))}
        <li>
          <ShowGuideAgain />
        </li>
      </ul>
    </main>
  );
}
