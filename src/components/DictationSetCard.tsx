import Link from 'next/link';

/**
 * 받아쓰기 목록의 카드 한 장.
 *
 * **아이에게는 「연습하기 / 시험 보기」를 카드에 바로 붙입니다.**
 * 예전에는 카드를 눌러 상세 화면에 들어가야 그 버튼이 나왔습니다 —
 * 아이가 매일 여는 화면에서 걸음을 하나 더 밟게 한 셈입니다.
 * 맞춤법은 이미 카드에서 바로 고르게 되어 있었는데 받아쓰기만 안 그랬습니다.
 * 같은 일을 하는 두 화면이 다르게 움직이면 아이가 매번 다시 익혀야 합니다.
 *
 * 보호자에게는 버튼 대신 카드를 통째로 누르게 둡니다.
 * 부모가 여기서 할 일은 푸는 것이 아니라 **문장을 보고 고치는 것**이라,
 * 상세 화면으로 들어가는 편이 맞습니다.
 */
export function DictationSetCard({
  href,
  name,
  detail,
  isChild,
}: {
  /** 상세 화면 주소. 연습·시험은 여기에 `/play`를 붙여 갑니다. */
  href: string;
  name: string;
  /** 이름 아래 한 줄 — 문장 수, 최고 점수 같은 것 */
  detail: string;
  isChild: boolean;
}) {
  if (!isChild) {
    return (
      <Link href={href} className="surface block p-4">
        <span className="display text-base font-bold">{name}</span>
        <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
          {detail}
        </span>
      </Link>
    );
  }

  return (
    <div className="surface p-4">
      <span className="display block text-base font-bold">{name}</span>
      <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
        {detail}
      </span>
      <div className="mt-3 flex gap-2">
        <Link
          href={`${href}/play?mode=practice`}
          className="btn btn-secondary flex-1 justify-center"
        >
          연습하기
        </Link>
        <Link href={`${href}/play?mode=exam`} className="btn btn-primary flex-1 justify-center">
          시험 보기
        </Link>
      </div>
    </div>
  );
}
