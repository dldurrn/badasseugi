/**
 * 처음 온 사람에게 **그 화면에 있는 것만** 짚어 줍니다.
 *
 * 예전에는 홈에 카드 하나를 띄우고 다섯 걸음을 넘기게 했습니다.
 * 문제는 「사진으로 문제 넣기」처럼 **다른 화면 안에 있는 것**은 말로만 알려 줄 수밖에 없었고,
 * 말로 들은 것은 5분 뒤에 잊힌다는 점입니다.
 *
 * 그래서 화면마다 그 화면 것만 짚습니다. 부모가 실제로 「문제 세트 만들기」에 들어왔을 때
 * 거기서 앨범·촬영 버튼을 짚어 주면, 알려 주는 시점과 쓰는 시점이 같아집니다.
 *
 * 짚을 곳은 `data-coach="…"` 로 표시합니다. CSS 선택자를 여기 적어 두면
 * 나중에 클래스 하나 바뀔 때 **조용히 안 뜹니다** — 안 뜨는 것은 아무도 신고하지 않습니다.
 */

export type TourId = 'home-parent' | 'home-child' | 'new-set' | 'session';

export interface CoachStep {
  /** `data-coach` 값 */
  target: string;
  title: string;
  body: string;
}

/**
 * 기기에 기억합니다(localStorage).
 *
 * 부모 폰과 아이 태블릿이 따로인 경우가 많아, 기기별로 두는 편이
 * 오히려 각자 한 번씩 보게 되어 맞습니다. 계정에 두면 부모가 폰에서 본 것 때문에
 * 아이 태블릿에서는 아무 안내도 안 뜹니다.
 */
const STORAGE_PREFIX = 'badasseugi:coach:';

export function storageKey(tour: TourId): string {
  return `${STORAGE_PREFIX}${tour}`;
}

export const TOURS: Record<TourId, CoachStep[]> = {
  'home-parent': [
    {
      target: 'profile',
      title: '지금은 보호자 화면이에요',
      body: '여기를 눌러 아이 화면으로 바꿔요. 아이 화면에서는 문제 만들기와 리포트가 보이지 않아요 — 정답 문장을 미리 보지 못하게요.',
    },
    {
      target: 'new-set',
      title: '문제지를 찍으면 글자로 들어와요',
      body: '학교에서 받아온 받아쓰기 문제지를 사진으로 넣을 수 있어요. 직접 쳐도 되고요. 아무것도 안 넣어도 1단계부터 20단계까지 이미 들어 있어요.',
    },
    {
      target: 'report',
      title: '무엇을 어려워하는지 봐요',
      body: '받침을 자주 틀리는지 띄어쓰기를 자주 틀리는지 한눈에 보여요.',
    },
  ],

  'home-child': [
    {
      target: 'dictation',
      title: '듣고 칸에 써요',
      body: '문장을 읽어 주면 원고지 칸에 한 글자씩 써요. 잘 안 들리면 몇 번이든 다시 들을 수 있어요.',
    },
    {
      target: 'notes',
      title: '틀린 건 여기 모여요',
      body: '두 번 잇달아 맞히면 별 두 개를 받고 졸업이에요. 한 번이라도 틀리면 별이 다시 0이 돼요.',
    },
  ],

  'new-set': [
    {
      target: 'photo',
      title: '여기가 제일 빠른 길이에요',
      body: '문제지를 앨범에서 고르거나 그 자리에서 찍으면 문장이 저절로 들어와요. 열 문장을 손으로 치던 걸 30초에 끝냅니다.',
    },
    {
      target: 'sentences',
      title: '글자는 꼭 한 번 봐 주세요',
      body: '사진은 잘못 읽힐 수 있어요. 여기 적힌 문장이 그대로 채점 기준이라, 틀린 채로 두면 아이가 바르게 쓰고도 틀렸다고 나와요.',
    },
  ],

  session: [
    {
      target: 'listen',
      title: '눌러서 들어요',
      body: '몇 번이든 다시 들을 수 있어요. 다시 들어도 똑같이 읽어 줘요.',
    },
    {
      target: 'write',
      title: '칸마다 한 글자씩',
      body: '띄어쓰기도 한 칸이에요. 고칠 칸을 짚고 지우면 그 칸이 지워져요.',
    },
    {
      target: 'check',
      title: '바로 채점하지 않아요',
      body: '「확인」을 누르면 내가 쓴 것을 먼저 보여줘요. 고칠 게 있으면 다시 고치고, 괜찮으면 그때 제출해요.',
    },
  ],
};

/**
 * 화면에 없는 대상은 건너뜁니다.
 *
 * 같은 화면이라도 그때그때 없는 것이 있습니다 —
 * 아이 홈에는 리포트가 없고, 세션 화면의 「확인」은 쓰는 중일 때만 있습니다.
 * 없는 것을 짚으면 **아무것도 없는 자리에 동그라미가 떠서** 무엇을 보라는 건지 알 수 없습니다.
 */
export function visibleSteps(steps: CoachStep[], present: (target: string) => boolean): CoachStep[] {
  return steps.filter((s) => present(s.target));
}

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * 강조할 네모. 대상보다 조금 넉넉하게 잡고, 화면 밖으로는 안 나가게 자릅니다.
 *
 * 자르지 않으면 화면 위쪽에 붙은 대상에서 음수 top이 나와,
 * 구멍이 화면 밖으로 밀려 어두운 막만 남습니다.
 */
export function spotlightBox(rect: Box, viewport: { width: number; height: number }, pad = 8): Box {
  const top = Math.max(4, rect.top - pad);
  const left = Math.max(4, rect.left - pad);
  const right = Math.min(viewport.width - 4, rect.left + rect.width + pad);
  const bottom = Math.min(viewport.height - 4, rect.top + rect.height + pad);
  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export type Placement = 'above' | 'below';

/**
 * 말풍선을 대상 위에 놓을지 아래에 놓을지, 가로로는 어디에 둘지.
 *
 * 가로는 대상 가운데에 맞추되 화면 밖으로 안 나가게 밀어 넣습니다.
 * 밀어 넣지 않으면 화면 오른쪽 끝 버튼을 짚을 때 말풍선이 잘려 글이 안 읽힙니다.
 */
export function balloonPlacement(
  spot: Box,
  balloon: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 12,
  margin = 12,
): { placement: Placement; top: number; left: number } {
  const roomBelow = viewport.height - (spot.top + spot.height);
  const roomAbove = spot.top;
  // 아래가 좁아도 위가 더 좁으면 그냥 아래에 둡니다. 둘 다 좁으면 넓은 쪽입니다.
  const placement: Placement =
    roomBelow >= balloon.height + gap + margin || roomBelow >= roomAbove ? 'below' : 'above';

  const rawTop =
    placement === 'below' ? spot.top + spot.height + gap : spot.top - balloon.height - gap;
  const top = Math.min(
    Math.max(margin, rawTop),
    Math.max(margin, viewport.height - balloon.height - margin),
  );

  const rawLeft = spot.left + spot.width / 2 - balloon.width / 2;
  const left = Math.min(
    Math.max(margin, rawLeft),
    Math.max(margin, viewport.width - balloon.width - margin),
  );

  return { placement, top, left };
}

/** 「사용법 다시 보기」가 부릅니다. 네 화면 것을 한꺼번에 되살립니다. */
export function resetCoach(): void {
  for (const tour of Object.keys(TOURS) as TourId[]) {
    window.localStorage.removeItem(storageKey(tour));
  }
  /*
    예전 카드형 안내가 남긴 표시도 함께 지웁니다.
    안 지우면 옛 앱을 쓰던 기기에 쓸모없는 값이 영영 남습니다.
  */
  window.localStorage.removeItem('badasseugi:onboarded:parent');
  window.localStorage.removeItem('badasseugi:onboarded:child');
}
