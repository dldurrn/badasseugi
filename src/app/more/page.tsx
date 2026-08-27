import Link from 'next/link';
import { ShowGuideAgain } from '@/components/ShowGuideAgain';
import { SoundToggle } from '@/components/SoundToggle';
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
    /*
      설정은 보호자 화면에만 둡니다.

      아이가 설정에서 바꿀 것은 효과음 하나뿐인데, 그것 하나 때문에
      화면을 한 번 더 들어가게 할 이유가 없습니다. 아래에 스위치로 바로 둡니다.
    */
    ...(isParent
      ? [
          {
            href: '/settings',
            name: '설정',
            description: '아이가 푸는 방식, 자녀 프로필, 계정',
          },
        ]
      : []),
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
        {/*
          아이가 스스로 바꿀 것은 이것 하나입니다.
          조용히 해야 할 때 아이가 직접 끌 수 있어야 하므로 여기에 둡니다.
        */}
        {!isParent && (
          <li>
            <SoundToggle />
          </li>
        )}
        <li>
          <ShowGuideAgain />
        </li>
      </ul>
    </main>
  );
}
