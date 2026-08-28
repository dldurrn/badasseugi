/**
 * 「홈 화면에 두기」 안내.
 *
 * 스토어 앱을 만들지 않기로 했으니(CLAUDE.md · 홈 화면에 앉히기)
 * 아이 기기에 아이콘으로 앉는 일은 **부모가 손으로** 해야 합니다.
 * 그런데 브라우저가 알아서 권해 주는 경우가 거의 없습니다.
 *
 * - **iOS 는 설치 안내가 아예 없습니다.** 애플이 지원하지 않습니다.
 *   사용자가 Safari 에서 공유 → 「홈 화면에 추가」를 직접 눌러야 합니다.
 * - **안드로이드 Chrome 의 자동 배너는 서비스워커를 요구합니다.**
 *   우리는 일부러 두지 않았습니다 — 소리가 서버라 오프라인이 무의미하고,
 *   캐시가 한 겹 끼면 고친 화면이 언제 반영되는지 알기 어려워집니다.
 * - **그리고 단톡방 링크는 카카오톡 인앱 브라우저에서 열립니다.**
 *   거기엔 「홈 화면에 추가」가 아예 없습니다. 이게 실제로 가장 많이 막히는 자리입니다.
 *   맘카페·학부모 단톡방이 유통 경로라 거의 모든 첫 방문이 여기를 지납니다.
 *
 * 그래서 브라우저에 기대지 않고 우리가 직접 안내합니다.
 */

export type Surface =
  /** 이미 홈 화면에서 열렸습니다. 더 권할 것이 없습니다 */
  | 'standalone'
  /** 카카오톡·네이버 같은 앱 속 브라우저. 먼저 밖으로 나가야 합니다 */
  | 'inapp'
  /** iOS Safari — 공유 메뉴로 됩니다 */
  | 'ios'
  /** iOS 의 Chrome·Firefox 등. 여기서는 안 되고 Safari 로 옮겨야 합니다 */
  | 'ios-other'
  /** 안드로이드 Chrome·삼성인터넷 */
  | 'android'
  /** PC. 아이가 쓸 기기가 아니라 폰·태블릿으로 넘깁니다 */
  | 'desktop';

/** 앱 속 브라우저를 쓰는 곳들. 한국에서 실제로 링크가 열리는 순서대로 봅니다. */
const INAPP = [
  { name: '카카오톡', test: /KAKAOTALK/i },
  { name: '네이버 앱', test: /NAVER\(inapp/i },
  { name: '인스타그램', test: /Instagram/i },
  { name: '페이스북', test: /FBAN|FBAV/i },
  { name: '라인', test: /\bLine\//i },
  { name: '다음 앱', test: /DaumApps/i },
] as const;

/** 어느 앱 속에서 열렸는지. 아니면 null */
export function inappName(ua: string): string | null {
  return INAPP.find((a) => a.test.test(ua))?.name ?? null;
}

/**
 * 지금 어디서 보고 있는지.
 *
 * **인앱 브라우저를 가장 먼저 봅니다.** 카카오톡 UA 에도 Chrome·Safari 가 들어 있어서,
 * 뒤에서 보면 평범한 Chrome 으로 잘못 읽고 있지도 않은 메뉴를 누르라고 합니다.
 */
export function detectSurface(ua: string, standalone: boolean): Surface {
  if (standalone) return 'standalone';
  if (inappName(ua)) return 'inapp';

  // 아이패드는 iPadOS 13부터 스스로를 Mac 이라고 말합니다. 손가락이 닿는지로 가릅니다.
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (isIOS) {
    // Safari 가 아닌 iOS 브라우저는 UA 에 제 이름을 남깁니다(CriOS, FxiOS, EdgiOS…).
    return /CriOS|FxiOS|EdgiOS|OPT\//.test(ua) ? 'ios-other' : 'ios';
  }
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/** 아이패드가 Mac 인 척하는 것까지 잡으려면 손가락 수가 필요합니다(화면에서만 알 수 있음). */
export function looksLikeIpad(ua: string, maxTouchPoints: number): boolean {
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

export interface Recipe {
  title: string;
  lead: string;
  steps: string[];
  note?: string;
}

export const RECIPES: Record<Exclude<Surface, 'standalone'>, Recipe> = {
  /*
    인앱 브라우저에서는 설치가 아예 불가능합니다.
    그래서 여기서만은 「홈 화면에 추가하는 법」이 아니라 **「밖으로 나가는 법」**을 알려 줍니다.
    이 단계를 못 넘기면 나머지 안내가 전부 헛것입니다.
  */
  inapp: {
    title: '먼저 브라우저로 열어 주세요',
    lead: '지금은 앱 속 화면이라 홈 화면에 둘 수 없어요. 한 걸음만 거치면 돼요.',
    steps: [
      '화면 오른쪽 아래의 ⋯ 또는 브라우저 아이콘을 누르세요',
      '「다른 브라우저로 열기」를 고르세요 (아이폰은 Safari, 안드로이드는 Chrome)',
      '열린 화면에서 이 안내를 다시 열면 다음 걸음을 알려 드려요',
    ],
    note: '주소를 복사해서 브라우저에 붙여 넣어도 똑같아요.',
  },

  ios: {
    title: '홈 화면에 두기',
    lead: '아이가 앱처럼 바로 열 수 있어요. 주소창도 사라집니다.',
    steps: [
      '화면 아래 가운데의 공유 버튼(↑ 가 든 네모)을 누르세요',
      '목록을 내려서 「홈 화면에 추가」를 고르세요',
      '오른쪽 위 「추가」를 누르면 끝이에요',
    ],
  },

  'ios-other': {
    title: 'Safari에서 열어 주세요',
    lead: '아이폰·아이패드는 Safari에서만 홈 화면에 둘 수 있어요.',
    steps: [
      '주소를 복사하세요',
      'Safari를 열고 주소를 붙여 넣으세요',
      '거기서 이 안내를 다시 열면 다음 걸음을 알려 드려요',
    ],
  },

  android: {
    title: '홈 화면에 두기',
    lead: '아이가 앱처럼 바로 열 수 있어요. 주소창도 사라집니다.',
    steps: [
      '화면 오른쪽 위의 ⋮ 를 누르세요',
      '「앱 설치」 또는 「홈 화면에 추가」를 고르세요',
      '「설치」를 누르면 끝이에요',
    ],
    note: '삼성 인터넷은 아래쪽 ☰ 안에 「현재 페이지 추가」로 들어 있어요.',
  },

  desktop: {
    title: '아이가 쓸 기기에서 열어 주세요',
    lead: '홈 화면에 두는 것은 폰이나 태블릿에서 할 수 있어요.',
    steps: [
      '아이가 쓸 폰이나 태블릿에서 이 주소를 여세요',
      '거기서 더보기 > 홈 화면에 두기를 누르면 방법을 알려 드려요',
    ],
    note: 'PC에서는 지금처럼 그냥 쓰셔도 아무 문제 없어요.',
  },
};

/*
  홈에 카드를 띄우기 시작하는 방문 횟수.

  첫 방문에 「설치하세요」부터 들이밀면, 아직 뭔지도 모르는 물건을
  홈 화면에 두라는 말이 됩니다. 두어 번 써 보고 남을 만하다 싶을 때가 맞습니다.
*/
export const HOME_CARD_AFTER = 3;

export const VISITS_KEY = 'badasseugi:visits';
export const INSTALL_DISMISSED_KEY = 'badasseugi:install-dismissed';

/**
 * 홈에 안내 카드를 띄울 것인가.
 *
 * 이미 홈 화면에서 열렸으면 절대 띄우지 않습니다 —
 * 시킨 대로 한 사람에게 또 시키는 것만큼 성의 없어 보이는 것이 없습니다.
 */
export function shouldOfferOnHome(o: {
  surface: Surface;
  visits: number;
  dismissed: boolean;
}): boolean {
  if (o.surface === 'standalone') return false;
  if (o.dismissed) return false;
  return o.visits >= HOME_CARD_AFTER;
}
