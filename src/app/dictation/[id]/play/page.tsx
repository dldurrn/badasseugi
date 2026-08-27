import { notFound, redirect } from 'next/navigation';
import { DictationRunner } from '@/components/DictationRunner';
import { getSet } from '@/lib/data';
import { readActiveChild } from '@/lib/profile-server';
import { readSettings } from '@/lib/settings-server';
import type { Mode } from '@/lib/types';

/**
 * 받아쓰기 세션.
 *
 * 자녀 모드에서만 들어올 수 있습니다.
 * 누구의 기록인지 정하지 못한 채 풀면 저장할 곳이 없기 때문입니다.
 */
export default async function PlaySetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; r?: string }>;
}) {
  const [{ id }, { mode: rawMode, r }] = await Promise.all([params, searchParams]);

  const [child, settings] = await Promise.all([readActiveChild(), readSettings()]);
  if (!child) redirect('/children');

  const set = await getSet(id);
  if (!set || set.sentences.length === 0) notFound();

  const mode: Mode = rawMode === 'exam' ? 'exam' : 'practice';

  return (
    <DictationRunner
      /*
        "한 번 더 풀기"가 붙이는 `r` 값을 key 로 씁니다.
        주소만 바꾸면 React 가 같은 자리의 같은 부품이라 판단해 재사용하고,
        안에 든 '결과' 상태가 그대로 남아 결과 화면이 계속 보입니다.
        key 가 바뀌어야 비로소 새 세션으로 다시 만들어집니다.
      */
      key={`${set.id}-${mode}-${r ?? 'first'}`}
      childId={child.id}
      // refId는 문장 원문입니다. 오답노트가 문장 단위로 쌓이도록 맞춘 규약입니다.
      items={set.sentences.map((sentence) => ({ refId: sentence, sentence }))}
      mode={mode}
      title={set.name}
      // 내장 세트는 sets 테이블에 없어 외래키를 쓸 수 없습니다. 컬럼이 갈립니다.
      setId={set.builtin ? null : set.id}
      builtinSetId={set.builtin ? set.id : null}
      listHref={`/dictation/${set.id}`}
      settings={settings.effective}
      retryHref={`/dictation/${set.id}/play?mode=${mode}`}
    />
  );
}
