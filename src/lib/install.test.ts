import { describe, expect, it } from 'vitest';
import {
  HOME_CARD_AFTER,
  RECIPES,
  type Surface,
  detectSurface,
  inappName,
  looksLikeIpad,
  shouldOfferOnHome,
} from './install';

/**
 * 여기서 지킬 것 —
 * **엉뚱한 안내는 안내가 없는 것보다 나쁩니다.**
 *
 * 「오른쪽 위 ⋮ 를 누르세요」라고 했는데 그런 게 없으면, 부모는 자기가
 * 뭘 잘못한 줄 알고 한참 헤매다 그만둡니다. 그래서 판별을 문자열로 못 박아 둡니다.
 */

// 실제 기기에서 나오는 UA 들입니다. 손으로 지어내면 판별이 통과해도 소용이 없습니다.
const UA = {
  카카오톡_안드로이드:
    'Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.4.5',
  카카오톡_아이폰:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.0',
  네이버앱:
    'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.0.0)',
  인스타그램:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 335.0.0.32.98',
  아이폰_사파리:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  아이폰_크롬:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  아이패드_사파리:
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  안드로이드_크롬:
    'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  삼성인터넷:
    'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  맥_사파리:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  윈도우_크롬:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
} as const;

describe('어디서 보고 있는지', () => {
  it('카카오톡 안에서 열린 것을 안다 — 안드로이드·아이폰 둘 다', () => {
    /*
      이게 제일 중요합니다. 단톡방 링크는 전부 여기로 열립니다.
      카카오톡 UA 에는 Chrome 과 Safari 가 함께 들어 있어서,
      순서를 잘못 두면 평범한 Chrome 으로 읽고 있지도 않은 메뉴를 누르라고 합니다.
    */
    expect(detectSurface(UA.카카오톡_안드로이드, false)).toBe('inapp');
    expect(detectSurface(UA.카카오톡_아이폰, false)).toBe('inapp');
  });

  it('다른 앱 속 브라우저도 안다', () => {
    expect(detectSurface(UA.네이버앱, false)).toBe('inapp');
    expect(detectSurface(UA.인스타그램, false)).toBe('inapp');
  });

  it('어느 앱 속인지 이름을 댄다', () => {
    // 「지금 카카오톡 안에서 보고 있어요」라고 짚어 줘야 내 얘기로 읽힙니다.
    expect(inappName(UA.카카오톡_아이폰)).toBe('카카오톡');
    expect(inappName(UA.네이버앱)).toBe('네이버 앱');
    expect(inappName(UA.아이폰_사파리)).toBeNull();
  });

  it('아이폰 사파리와 아이폰 크롬을 가른다', () => {
    // 아이폰에서는 사파리에서만 홈 화면에 둘 수 있습니다. 크롬에는 그 메뉴가 없습니다.
    expect(detectSurface(UA.아이폰_사파리, false)).toBe('ios');
    expect(detectSurface(UA.아이패드_사파리, false)).toBe('ios');
    expect(detectSurface(UA.아이폰_크롬, false)).toBe('ios-other');
  });

  it('안드로이드는 크롬도 삼성인터넷도 같은 갈래', () => {
    // 메뉴 자리가 달라 그건 note 로 덧붙입니다. 갈래를 늘리면 안내가 흩어집니다.
    expect(detectSurface(UA.안드로이드_크롬, false)).toBe('android');
    expect(detectSurface(UA.삼성인터넷, false)).toBe('android');
  });

  it('PC 는 폰·태블릿으로 넘긴다', () => {
    expect(detectSurface(UA.맥_사파리, false)).toBe('desktop');
    expect(detectSurface(UA.윈도우_크롬, false)).toBe('desktop');
  });

  it('아이패드가 Mac 인 척해도 손가락 수로 잡는다', () => {
    // iPadOS 13부터 아이패드가 UA 에 Macintosh 라고 적습니다.
    expect(looksLikeIpad(UA.맥_사파리, 5)).toBe(true);
    expect(looksLikeIpad(UA.맥_사파리, 0)).toBe(false);
    expect(looksLikeIpad(UA.윈도우_크롬, 5)).toBe(false);
  });

  it('이미 홈 화면에서 열렸으면 무엇이든 standalone', () => {
    for (const ua of Object.values(UA)) {
      expect(detectSurface(ua, true)).toBe('standalone');
    }
  });
});

describe('안내 문구', () => {
  const surfaces = Object.keys(RECIPES) as Array<Exclude<Surface, 'standalone'>>;

  it('모든 갈래에 제목·설명·걸음이 있다', () => {
    for (const s of surfaces) {
      expect(RECIPES[s].title.length, s).toBeGreaterThan(0);
      expect(RECIPES[s].lead.length, s).toBeGreaterThan(0);
      expect(RECIPES[s].steps.length, s).toBeGreaterThan(0);
    }
  });

  it('걸음이 셋을 넘지 않는다 — 넘으면 도중에 그만둡니다', () => {
    for (const s of surfaces) {
      expect(RECIPES[s].steps.length, s).toBeLessThanOrEqual(3);
    }
  });

  it('앱 속 브라우저에는 「홈 화면에 추가」를 시키지 않는다', () => {
    /*
      거기엔 그 메뉴가 아예 없습니다. 시키면 부모가 없는 것을 찾다가 그만둡니다.
      먼저 밖으로 나가는 법부터 알려 줘야 합니다.
    */
    const 걸음 = RECIPES.inapp.steps.join(' ');
    expect(걸음).not.toContain('홈 화면에 추가');
    expect(걸음).toMatch(/브라우저/);
  });

  it('아이폰의 다른 브라우저에서는 Safari 로 옮기라고 한다', () => {
    expect(RECIPES['ios-other'].title + RECIPES['ios-other'].lead).toContain('Safari');
  });

  it('아이폰 안내는 공유 버튼을 짚는다', () => {
    expect(RECIPES.ios.steps.join(' ')).toMatch(/공유/);
  });

  it('삼성인터넷을 쓰는 집을 빠뜨리지 않는다', () => {
    // 한국에서 흔한데 메뉴 자리가 크롬과 다릅니다.
    expect(RECIPES.android.note ?? '').toMatch(/삼성/);
  });
});

describe('홈 카드를 언제 띄우나', () => {
  const base = { surface: 'ios' as Surface, visits: HOME_CARD_AFTER, dismissed: false };

  it('첫 방문에는 안 띄운다 — 아직 뭔지도 모르는데 설치부터 권할 수 없다', () => {
    expect(shouldOfferOnHome({ ...base, visits: 1 })).toBe(false);
    expect(HOME_CARD_AFTER).toBeGreaterThanOrEqual(2);
  });

  it('몇 번 써 본 뒤에 한 번 권한다', () => {
    expect(shouldOfferOnHome({ ...base, visits: HOME_CARD_AFTER })).toBe(true);
    expect(shouldOfferOnHome({ ...base, visits: HOME_CARD_AFTER + 20 })).toBe(true);
  });

  it('이미 홈 화면에서 열렸으면 절대 안 띄운다', () => {
    // 시킨 대로 한 사람에게 또 시키는 것만큼 성의 없어 보이는 것이 없습니다.
    expect(shouldOfferOnHome({ ...base, surface: 'standalone', visits: 999 })).toBe(false);
  });

  it('한 번 닫으면 다시 안 띄운다', () => {
    expect(shouldOfferOnHome({ ...base, dismissed: true, visits: 999 })).toBe(false);
  });

  it('PC 에서도 띄운다 — 아이 기기로 옮기라고 알려 줘야 한다', () => {
    // 부모가 PC 로만 보고 있으면 아이 태블릿에 앉힐 생각 자체를 못 합니다.
    expect(shouldOfferOnHome({ ...base, surface: 'desktop' })).toBe(true);
  });
});
