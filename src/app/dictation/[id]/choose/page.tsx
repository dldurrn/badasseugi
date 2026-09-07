import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChoiceBoard } from '@/components/ChoiceBoard';
import { EmptyState } from '@/components/EmptyState';
import { hasChoices } from '@/lib/choices';
import { getSet } from '@/lib/data';
import { readActiveChild } from '@/lib/profile-server';
import { readSettings } from '@/lib/settings-server';

/**
 * 골라서 익히기.
 *
 * **세션 라우트(`play`)와 일부러 갈라 두었습니다.**
 * `mode=` 값을 하나 더 만들면 `Mode` → `DictationRunner` → `saveSession` →
 * `/api/sessions` → `attempts`·`wrong_events`·트로피까지 「이 모드는 예외」 분기가 줄줄이 생깁니다.
 * 분기는 언젠가 하나가 빠지고, 빠지는 순간 2지선다 점수가 리포트 평균에 섞입니다.
 * 라우트를 가르면 **저장할 코드가 애초에 없습니다.**
 *
 * 자녀 모드에서만 들어옵니다. 보호자 화면에는 링크를 두지 않지만,
 * 여기서도 아이를 고르지 않았으면 설정(속도·목소리)을 읽을 수 없습니다.
 */
export default async function ChooseSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [child, settings] = await Promise.all([readActiveChild(), readSettings()]);
  if (!child) redirect('/children');

  const set = await getSet(id);
  if (!set || set.sentences.length === 0) notFound();

  /*
    고를 것이 없는 문장은 뺍니다.

    「포도」·「안경」처럼 받침이 ㄴ·ㅇ뿐이면 귀로 못 가릴 자리가 하나도 없습니다.
    그런 문장을 넣으면 아무것도 안 물어보고 다음으로 넘어가는 화면이 됩니다.
    이건 버그가 아니라 그 문장이 쉽다는 뜻입니다.
  */
  const items = set.sentences.filter(hasChoices);

  if (items.length === 0) {
    return (
      <main className="page">
        <header className="pb-5 pt-8">
          <Link href={`/dictation/${set.id}`} className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            ← {set.name}
          </Link>
        </header>
        <EmptyState
          title="여기는 고를 것이 없어요"
          description="이 세트는 소리만 듣고도 알 수 있는 쉬운 낱말들이에요. 직접 써 보는 쪽이 더 도움이 돼요."
          action={
            <Link href={`/dictation/${set.id}/play?mode=practice`} className="btn btn-primary">
              연습하러 가기
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <ChoiceBoard
      items={items}
      title={set.name}
      listHref={`/dictation/${set.id}`}
      settings={settings.effective}
    />
  );
}
