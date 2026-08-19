import { notFound, redirect } from 'next/navigation';
import { SpellingRunner } from '@/components/SpellingRunner';
import { pickBalanced, type SpellingKind } from '@/data/spelling-bank';
import { readActiveChild } from '@/lib/profile-server';
import type { Mode } from '@/lib/types';

/**
 * 맞춤법 세션.
 *
 * 문제는 `pickBalanced()`로 고릅니다. 난이도를 섞어 뽑아서,
 * 고급 문항이 몰려 시험 점수가 실력과 무관하게 갈리지 않게 합니다.
 * 순서도 서버에서 섞습니다 — 화면에서 섞으면 서버가 그린 순서와 달라져 한 번 튑니다.
 */

const KINDS: Record<SpellingKind, string> = {
  mcq: '객관식',
  fill: '빈칸 채우기',
  find: '틀린 곳 찾기',
};

/** 한 번에 푸는 문제 수. 저학년이 지치지 않고 끝까지 갈 수 있는 길이로 둡니다. */
const PER_SESSION = 10;

export default async function SpellingSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ kind }, { mode: rawMode }] = await Promise.all([params, searchParams]);

  // `kind in KINDS`로 검사하면 'toString' 같은 상속 속성까지 통과합니다.
  if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) notFound();
  const spellingKind = kind as SpellingKind;

  const child = await readActiveChild();
  if (!child) redirect('/children');

  const questions = pickBalanced(spellingKind, PER_SESSION);
  if (questions.length === 0) notFound();

  const mode: Mode = rawMode === 'exam' ? 'exam' : 'practice';

  return (
    <SpellingRunner
      childId={child.id}
      questions={questions}
      kind={spellingKind}
      kindLabel={KINDS[spellingKind]}
      mode={mode}
      listHref="/spelling"
      retryHref={`/spelling/${spellingKind}?mode=${mode}`}
    />
  );
}
