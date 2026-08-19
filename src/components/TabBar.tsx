'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 하단 탭바.
 *
 * 아이콘은 이 앱의 소재에서 가져옵니다 — 격자, 연필, 별, 종이.
 * 라벨은 아이가 읽을 수 있는 짧은 명사로 두고, 동작 이름과 통일합니다.
 */

const TABS = [
  { href: '/', label: '홈', icon: HomeIcon },
  { href: '/dictation', label: '받아쓰기', icon: GridIcon },
  { href: '/spelling', label: '맞춤법', icon: PencilIcon },
  { href: '/notes', label: '오답노트', icon: StarIcon },
  { href: '/more', label: '더보기', icon: MoreIcon },
] as const;

/** 로그인·프로필 선택처럼 아직 '누가 쓰는지' 정해지지 않은 화면에서는 탭바를 감춥니다. */
const HIDDEN_ON = ['/login', '/auth', '/onboarding', '/children'];

/**
 * 문제를 푸는 중에도 감춥니다.
 *
 * 탭바가 보이면 나가기 확인 창(절대 원칙 2)을 지나치지 않고 빠져나갈 수 있습니다.
 * 나가는 길을 화면 안의 ← 하나로 모아야 "지금 나가면 기록이 안 남는다"를 알릴 수 있습니다.
 */
const SESSION_PATHS = [
  /^\/dictation\/[^/]+\/play$/,
  /^\/spelling\/[^/]+$/,
  /^\/notes\/practice$/,
];

export function TabBar() {
  const pathname = usePathname() ?? '/';
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  if (SESSION_PATHS.some((p) => p.test(pathname))) return null;

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40"
      style={{
        background: 'rgba(251, 250, 246, 0.94)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--rule)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ul className="mx-auto flex max-w-[560px] items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-1 py-2.5 transition-colors"
                style={{ color: active ? 'var(--grid)' : 'var(--ink-faint)' }}
              >
                <Icon active={active} />
                <span
                  className="text-[11px]"
                  style={{ fontWeight: active ? 700 : 500 }}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ---------- 아이콘 (선 굵기로 활성 상태를 표현) ---------- */

interface IconProps {
  active: boolean;
}

function base(active: boolean) {
  return {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: active ? 2.2 : 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

function HomeIcon({ active }: IconProps) {
  return (
    <svg {...base(active)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

/** 원고지 격자 — 받아쓰기 */
function GridIcon({ active }: IconProps) {
  return (
    <svg {...base(active)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M12 3.5v17M3.5 12h17" />
    </svg>
  );
}

/** 연필 — 맞춤법 */
function PencilIcon({ active }: IconProps) {
  return (
    <svg {...base(active)}>
      <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5 4 20z" />
      <path d="M14 6.5l3.5 3.5" />
    </svg>
  );
}

/** 별 — 오답노트 졸업 표시와 같은 기호 */
function StarIcon({ active }: IconProps) {
  return (
    <svg {...base(active)}>
      <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3L4.2 9.7l5.4-.8L12 4z" />
    </svg>
  );
}

function MoreIcon({ active }: IconProps) {
  return (
    <svg {...base(active)}>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
