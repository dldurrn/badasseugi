import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasChoices } from '@/lib/choices';
import { getSet } from '@/lib/data';
import { readActiveProfile } from '@/lib/profile-server';

/**
 * 세트 하나 — 어떻게 풀지 고르는 자리.
 *
 * 연습과 시험의 차이를 여기서 분명히 말해 줍니다.
 * 시험을 눌렀는데 보상 규칙을 모르면, 끝까지 마쳐야 하는 이유를 알 수 없습니다.
 */
export default async function SetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const set = await getSet(id);
  if (!set) notFound();

  const { view } = await readActiveProfile();
  const isParent = view === 'parent';

  /*
    고를 것이 하나도 없는 세트에는 링크를 두지 않습니다.
    1·2단계처럼 받침이 ㄴ·ㅇ뿐인 낱말만 있으면 귀로 못 가릴 자리가 없습니다 —
    눌러 봐야 「고를 것이 없어요」가 나오는 문을 만들지 않습니다.
  */
  const hasChoice = set.sentences.some(hasChoices);

  return (
    <main className="page">
      <header className="pb-5 pt-8">
        <Link href="/dictation" className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          ← 받아쓰기
        </Link>
        <h1 className="display mt-3 text-2xl font-bold">{set.name}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          문장 {set.sentences.length}개
        </p>
      </header>

      {isParent ? (
        <>
          <h2 className="section-title mb-2">문장</h2>
          <ol className="surface mb-4 flex flex-col gap-2 p-4">
            {set.sentences.map((sentence, i) => (
              <li key={i} className="flex gap-2 text-[15px]">
                <span className="tabular-nums" style={{ color: 'var(--ink-faint)' }}>
                  {i + 1}
                </span>
                <span>{sentence}</span>
              </li>
            ))}
          </ol>
          {/* 내장 세트는 앱이 갖고 있는 것이라 고칠 수 없습니다. */}
          {!set.builtin && (
            <div className="flex gap-2">
              <Link
                href={`/dictation/${set.id}/edit`}
                className="btn btn-secondary flex-1 justify-center"
              >
                고치기
              </Link>
            </div>
          )}
          <p className="mt-4 text-center text-xs" style={{ color: 'var(--ink-faint)' }}>
            푸는 것은 아이 화면에서 할 수 있어요.
            <br />
            보호자 화면에서 풀면 누구의 기록인지 정할 수 없어요.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {/*
              세 장을 **한 묶음**에 두고, 듣고 고르기를 **맨 위**에 둡니다.

              처음에는 「채점하는 모드가 아니니 눈에 덜 띄게」라며 카드 밖에 옅은 한 줄로 두었는데,
              그 자리가 카드 묶음과 안내 문구 사이라 **있는 줄도 모르고 지나갔습니다.**
              눈에 덜 띄게 하려던 것이 안 보이게 만들었습니다.

              맨 위인 것은 **가장 가볍게 시작할 수 있는 것이 맨 위**여야 하기 때문입니다.
              문을 여는 자리에 시험이 있으면 오늘 할 마음이 있다가도 닫힙니다.
              점수가 안 남는 쪽 → 남는 쪽 → 보상이 걸린 쪽 차례입니다.
              「연습」이라는 말은 여전히 쓰지 않습니다 — mode=practice 는 채점을 하니까요.
            */}
            {hasChoice && (
              <Link href={`/dictation/${set.id}/choose`} className="surface block p-4">
                <span className="display block text-lg font-bold">듣고 고르기</span>
                <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
                  키보드 없이 손가락으로 골라요. 점수는 남지 않아요
                </span>
              </Link>
            )}
            <Link href={`/dictation/${set.id}/play?mode=practice`} className="surface block p-4">
              <span className="display block text-lg font-bold">연습하기</span>
              <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
                틀려도 괜찮아요. 편하게 여러 번 해 봐요
              </span>
            </Link>
            <Link href={`/dictation/${set.id}/play?mode=exam`} className="surface block p-4">
              <span className="display block text-lg font-bold">시험 보기</span>
              <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
                끝까지 마치고 90점을 넘기면 배지, 100점이면 카드를 받아요
              </span>
            </Link>
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
            중간에 나가면 점수와 별이 남지 않아요.
            <br />
            시작하면 끝까지 해 봐요.
          </p>
        </>
      )}
    </main>
  );
}
