import Link from 'next/link';
import { SPELLING_BANK } from '@/data/spelling-bank';
import { readActiveProfile } from '@/lib/profile-server';

const KINDS = [
  {
    kind: 'mcq' as const,
    name: '객관식',
    description: '두 표기 중 맞는 것을 골라요',
  },
  {
    kind: 'fill' as const,
    name: '빈칸 채우기',
    description: '문장에 알맞은 말을 넣어요',
  },
  {
    kind: 'find' as const,
    name: '틀린 곳 찾기',
    description: '문장에서 잘못 쓴 낱말을 찾아요',
  },
];

/**
 * 맞춤법 — 세 가지 방식 중 고르기. 문제는 앱이 미리 갖고 있습니다.
 * 연습과 시험을 여기서 바로 고르게 해서, 들어갔다 나오는 걸음을 줄입니다.
 */
export default async function SpellingPage() {
  const { view } = await readActiveProfile();
  const isChild = view === 'child';

  return (
    <main className="page">
      <header className="mb-5 pt-4">
        <h1 className="display text-2xl font-bold">맞춤법</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          자주 헷갈리는 말을 세 가지 방식으로 익혀요
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {KINDS.map(({ kind, name, description }) => {
          const count = SPELLING_BANK.filter((q) => q.kind === kind).length;
          return (
            <li key={kind} className="surface p-4">
              <span className="display block text-lg font-bold">{name}</span>
              <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
                {description} · {count}문제
              </span>

              {isChild && (
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/spelling/${kind}?mode=practice`}
                    className="btn btn-secondary flex-1 justify-center"
                  >
                    연습하기
                  </Link>
                  <Link
                    href={`/spelling/${kind}?mode=exam`}
                    className="btn btn-primary flex-1 justify-center"
                  >
                    시험보기
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isChild ? (
        <p className="mt-5 text-center text-xs leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
          시험을 끝까지 마치고 90점을 넘기면 배지, 100점이면 카드를 받아요.
          <br />
          중간에 나가면 기록이 남지 않아요.
        </p>
      ) : (
        <p className="mt-5 text-center text-xs leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
          맞춤법 문제는 앱이 미리 갖고 있어요. 따로 넣지 않아도 돼요.
          <br />
          푸는 것은 아이 화면에서 할 수 있어요.
        </p>
      )}
    </main>
  );
}
