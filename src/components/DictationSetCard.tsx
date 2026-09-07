import Link from 'next/link';

/**
 * 받아쓰기 목록의 카드 한 장.
 *
 * **아이에게는 「연습하기 / 시험 보기 / 듣고 고르기」를 카드에 바로 붙입니다.**
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
  hasChoice = false,
}: {
  /** 상세 화면 주소. 연습·시험은 여기에 `/play`를 붙여 갑니다. */
  href: string;
  name: string;
  /** 이름 아래 한 줄 — 문장 수, 최고 점수 같은 것 */
  detail: string;
  isChild: boolean;
  /** 「듣고 고르기」로 풀 것이 있는 세트인가. 없으면 그 줄을 그리지 않습니다 */
  hasChoice?: boolean;
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

      {/*
        「듣고 고르기」는 **줄을 따로** 씁니다.

        한 줄에 셋을 넣으면 360px 폰에서 버튼 하나가 93px이라 다섯 글자가 끼고,
        더 좁은 기기에서는 줄바꿈이 납니다. 이름을 줄이는 것은 안 됩니다 —
        같은 동작이 화면마다 다른 이름으로 불리면 아이가 매번 다시 익혀야 합니다.

        아래에 두는 것은 상세 화면(맨 위)과 뒤집힌 순서인데 일부러입니다.
        상세는 「이 세트를 어떻게 할까」를 고르는 자리지만, 목록은 **어느 세트인지**를
        훑는 자리라 눈이 제목을 따라 내려갑니다. 여기서 맨 위에 두면
        스물세 장 내내 같은 것이 눈길을 가로챕니다.
      */}
      {hasChoice && (
        <Link href={`${href}/choose`} className="btn btn-secondary mt-2 w-full justify-center">
          듣고 고르기
        </Link>
      )}
    </div>
  );
}
