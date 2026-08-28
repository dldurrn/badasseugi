import Link from 'next/link';
import { CoachMarks } from '@/components/CoachMarks';
import { InstallCard } from '@/components/InstallCard';
import { getHomeSummary } from '@/lib/data';
import { readActiveProfile } from '@/lib/profile-server';

/**
 * 홈 — 오늘 무엇을 하면 되는지 한눈에.
 *
 * 머리말에 지금 누가 쓰고 있는지 띄웁니다.
 * 아이가 형제 프로필로 잘못 들어와 기록이 섞이는 일을 막으려면
 * '내 얼굴'이 첫 화면에 보여야 합니다.
 */
export default async function HomePage() {
  const { view, child } = await readActiveProfile();
  const isParent = view === 'parent';

  // 보호자 화면에는 아이의 오늘 요약을 띄우지 않습니다. 그 자리는 리포트가 맡습니다.
  const summary = !isParent && child ? await getHomeSummary(child.id) : null;
  const today = summary?.today ?? null;
  const activeNotes = summary?.activeNotes ?? 0;
  const trophyCount = summary?.trophyCount ?? 0;

  return (
    <main className="page">
      <header className="pb-6 pt-8 text-center">
        {/*
          금색이 아니라 초록입니다.

          금색은 보상 전용입니다(절대 원칙 · 디자인). 앱을 열 때마다 처음 보는 색이
          금색이면, 100점을 받았을 때의 금색이 특별할 까닭이 없어집니다.
          여기 필요한 것은 「상」이 아니라 「제목 위의 표시」라 구조색인 초록이 맞습니다.
        */}
        <div
          className="mx-auto mb-4 h-1 w-12 rounded-full"
          style={{ background: 'var(--grid)' }}
        />
        <h1 className="display title-entry text-[30px] font-bold">
          받아쓰기 공책
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          잘 듣고, 또박또박 써 보아요
        </p>

        <Link
          href="/children"
          data-coach="profile"
          className="surface mx-auto mt-4 inline-flex items-center gap-2 px-3 py-1.5"
          style={{ borderRadius: 999 }}
        >
          <span className="text-lg leading-none" aria-hidden="true">
            {isParent ? '👛' : (child?.avatar ?? '🐣')}
          </span>
          <span className="text-sm font-semibold">
            {isParent ? '보호자 화면' : (child?.nickname ?? '프로필 고르기')}
          </span>
          <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            바꾸기
          </span>
        </Link>
      </header>

      {/*
        처음 온 사람에게 이 화면에 있는 것만 하나씩 짚어 줍니다.
        부모와 아이는 할 일이 아예 달라서 짚을 곳도 다릅니다.
        한 번 보면 다시 안 뜨고, 더보기에서 되살릴 수 있습니다.
      */}
      <CoachMarks tour={isParent ? 'home-parent' : 'home-child'} />

      {/*
        홈 화면에 두라는 권유는 보호자 화면에만 둡니다.
        아이 화면에 띄워도 아이가 할 수 있는 일이 아닙니다.
      */}
      {isParent && <InstallCard />}

      <section className="mb-6 grid grid-cols-2 gap-3">
        <Link href="/dictation" data-coach="dictation" className="surface flex flex-col gap-1 p-4">
          <span className="display text-base font-bold">받아쓰기</span>
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            듣고 쓰기
          </span>
        </Link>
        <Link href="/spelling" className="surface flex flex-col gap-1 p-4">
          <span className="display text-base font-bold">맞춤법</span>
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            골라서 풀기
          </span>
        </Link>
      </section>

      {isParent ? (
        <>
          <h2 className="section-title mb-2">보호자</h2>
          <div className="surface p-5 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
            아이가 풀 문제를 넣어 두고, 리포트로 확인해요.
            <div className="mt-3 flex justify-center gap-2">
              <Link href="/dictation/new" data-coach="new-set" className="btn btn-secondary">
                문제 세트 만들기
              </Link>
              <Link href="/report" data-coach="report" className="btn btn-secondary">
                리포트
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="section-title mb-2">오늘의 요약</h2>
          <div className="surface mb-3 p-5 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
            {today ? (
              <>
                오늘 <b style={{ color: 'var(--ink)' }}>{today.count}번</b> 풀었어요 · 평균{' '}
                <b style={{ color: 'var(--ink)' }}>{today.average}점</b>
              </>
            ) : (
              '아직 오늘 기록이 없어요. 받아쓰기부터 시작해 볼까요?'
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/notes" data-coach="notes" className="surface flex flex-col gap-1 p-4">
              <span className="display text-base font-bold">오답노트</span>
              <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                {activeNotes > 0 ? `모으는 중 ${activeNotes}개` : '틀린 문제가 모여요'}
              </span>
            </Link>
            <Link href="/trophies" className="surface flex flex-col gap-1 p-4">
              <span className="display text-base font-bold">보관함</span>
              <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                {trophyCount > 0 ? `${trophyCount}개 모았어요` : '카드와 배지를 모아요'}
              </span>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
