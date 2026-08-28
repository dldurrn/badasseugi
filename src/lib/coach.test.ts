import { describe, expect, it } from 'vitest';
import {
  type Box,
  type TourId,
  TOURS,
  balloonPlacement,
  spotlightBox,
  storageKey,
  visibleSteps,
} from './coach';

/**
 * 여기서 지킬 것 —
 * **안 뜨는 안내는 아무도 신고하지 않습니다.**
 *
 * 코치마크는 대상이 없으면 조용히 사라집니다. 그게 맞는 동작이지만,
 * 그래서 어딘가 틀어져도 눈치채기 어렵습니다. 그 부분을 여기서 잡습니다.
 */

const ids = Object.keys(TOURS) as TourId[];
const VIEW = { width: 390, height: 844 }; // 폰 세로

describe('안내 내용', () => {
  it('모든 걸음에 짚을 곳과 할 말이 있다', () => {
    for (const id of ids) {
      expect(TOURS[id].length, id).toBeGreaterThan(0);
      for (const step of TOURS[id]) {
        expect(step.target, id).toMatch(/^[a-z-]+$/);
        expect(step.title.length, `${id}/${step.target}`).toBeGreaterThan(0);
        expect(step.body.length, `${id}/${step.target}`).toBeGreaterThan(0);
      }
    }
  });

  it('한 화면 안에서 같은 곳을 두 번 짚지 않는다', () => {
    for (const id of ids) {
      const targets = TOURS[id].map((s) => s.target);
      expect(new Set(targets).size, id).toBe(targets.length);
    }
  });

  it('걸음이 넷을 넘지 않는다 — 넘으면 끝까지 안 봅니다', () => {
    for (const id of ids) {
      expect(TOURS[id].length, id).toBeLessThanOrEqual(4);
    }
  });

  it('아이에게 하는 말이 화면의 버튼 이름과 같다', () => {
    /*
      「확인」을 눌러 「제출」하는 흐름인데 안내만 「입력을 완료」라고 하면
      아이는 그게 같은 것인 줄 모릅니다. 동작 이름은 화면 전체에서 하나여야 합니다.

      그래서 여기서 막는 것은 「제출·확인」이 아니라 **그 자리를 대신 부르는 다른 말**입니다.
    */
    const 딴말 = ['완료', '입력하세요', '전송', '등록', '취소'];
    for (const step of [...TOURS['home-child'], ...TOURS.session]) {
      for (const 말 of 딴말) {
        expect(step.title + step.body, `${step.target}: ${말}`).not.toContain(말);
      }
    }
  });
});

describe('제품이 뜻한 바를 지킨다', () => {
  it('부모 홈에서 사진으로 넣을 수 있다는 것을 알린다', () => {
    /*
      부모가 사는 것은 「문제지 타이핑 10분 → 30초」입니다.
      이걸 모르고 넘어가면 이 앱을 쓸 이유의 절반이 사라집니다.
    */
    const 사진 = TOURS['home-parent'].find((s) => s.target === 'new-set');
    expect(사진).toBeDefined();
    expect(사진!.title + 사진!.body).toMatch(/사진|찍/);
  });

  it('문제 만들기에서 앨범·촬영 버튼을 직접 짚는다', () => {
    expect(TOURS['new-set'].map((s) => s.target)).toContain('photo');
  });

  it('사진이 잘못 읽힐 수 있다는 경고가 빠지지 않는다', () => {
    /*
      여기 적힌 문장이 그대로 채점 기준입니다.
      경고를 빼면 아이가 바르게 쓰고도 틀렸다는 채점을 받습니다.
    */
    const 확인 = TOURS['new-set'].find((s) => s.target === 'sentences');
    expect(확인).toBeDefined();
    expect(확인!.body).toMatch(/채점/);
  });

  it('아이 세션 안내가 「확인은 바로 채점이 아니다」를 말한다', () => {
    // 절대 원칙 3 — 제출 전 최종 확인 단계.
    const 확인 = TOURS.session.find((s) => s.target === 'check');
    expect(확인).toBeDefined();
    expect(확인!.title + 확인!.body).toMatch(/채점/);
  });

  it('아이 홈 안내가 오답노트 졸업 규칙을 「연속 두 번」으로 말한다', () => {
    // 절대 원칙 5 — 날짜가 아니라 연속 2회.
    const 노트 = TOURS['home-child'].find((s) => s.target === 'notes');
    expect(노트!.body).toMatch(/잇달아|연속/);
    expect(노트!.body).not.toMatch(/내일|다음 ?날|하루/);
  });
});

describe('저장 키', () => {
  it('화면마다 다른 키를 쓴다', () => {
    const keys = ids.map(storageKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('예전 카드형 안내가 쓰던 키와 겹치지 않는다', () => {
    // 겹치면 옛 앱을 쓰던 기기에서 새 안내가 처음부터 「이미 봤음」이 됩니다.
    for (const key of ids.map(storageKey)) {
      expect(key).not.toBe('badasseugi:onboarded:parent');
      expect(key).not.toBe('badasseugi:onboarded:child');
    }
  });
});

describe('화면에 없는 것은 건너뛴다', () => {
  it('없는 대상은 걸음에서 빠진다', () => {
    // 아이 홈에는 리포트가 없고, 세션의 「확인」은 쓰는 중일 때만 있습니다.
    const 있는것 = new Set(['profile', 'new-set']);
    const 남은것 = visibleSteps(TOURS['home-parent'], (t) => 있는것.has(t));
    expect(남은것.map((s) => s.target)).toEqual(['profile', 'new-set']);
  });

  it('아무것도 없으면 빈 목록이 된다 — 안내를 아예 띄우지 않기 위해', () => {
    expect(visibleSteps(TOURS.session, () => false)).toEqual([]);
  });

  it('순서를 흐트러뜨리지 않는다', () => {
    const 남은것 = visibleSteps(TOURS.session, (t) => t !== 'write');
    expect(남은것.map((s) => s.target)).toEqual(['listen', 'check']);
  });
});

describe('강조할 네모', () => {
  const box = (top: number, left: number, width: number, height: number): Box => ({
    top,
    left,
    width,
    height,
  });

  it('대상보다 조금 넉넉하게 잡는다', () => {
    const spot = spotlightBox(box(100, 50, 200, 40), VIEW, 8);
    expect(spot).toEqual({ top: 92, left: 42, width: 216, height: 56 });
  });

  it('화면 위쪽에 붙은 대상에서 음수가 나오지 않는다', () => {
    const spot = spotlightBox(box(2, 1, 100, 30), VIEW, 8);
    expect(spot.top).toBeGreaterThanOrEqual(0);
    expect(spot.left).toBeGreaterThanOrEqual(0);
  });

  it('화면 밖으로 넘치지 않는다', () => {
    const spot = spotlightBox(box(800, 300, 200, 200), VIEW, 8);
    expect(spot.left + spot.width).toBeLessThanOrEqual(VIEW.width);
    expect(spot.top + spot.height).toBeLessThanOrEqual(VIEW.height);
  });

  it('완전히 화면 밖이어도 크기가 음수가 되지 않는다', () => {
    // 음수 크기를 그대로 style 에 넘기면 구멍이 뒤집혀 화면 전체가 밝아집니다.
    const spot = spotlightBox(box(2000, 2000, 100, 100), VIEW, 8);
    expect(spot.width).toBeGreaterThanOrEqual(0);
    expect(spot.height).toBeGreaterThanOrEqual(0);
  });
});

describe('말풍선 자리', () => {
  const balloon = { width: 320, height: 150 };

  it('아래에 자리가 있으면 아래에 둔다', () => {
    const spot = { top: 100, left: 40, width: 200, height: 44 };
    const { placement, top } = balloonPlacement(spot, balloon, VIEW);
    expect(placement).toBe('below');
    expect(top).toBeGreaterThan(spot.top + spot.height);
  });

  it('아래가 좁으면 위로 올린다', () => {
    const spot = { top: 700, left: 40, width: 200, height: 44 };
    const { placement, top } = balloonPlacement(spot, balloon, VIEW);
    expect(placement).toBe('above');
    expect(top + balloon.height).toBeLessThanOrEqual(spot.top);
  });

  it('대상 가운데에 맞춘다', () => {
    const spot = { top: 100, left: 35, width: 320, height: 44 };
    const { left } = balloonPlacement(spot, balloon, VIEW);
    expect(left).toBe(35);
  });

  it('오른쪽 끝 대상에서도 화면 밖으로 안 나간다', () => {
    const spot = { top: 100, left: 330, width: 56, height: 44 };
    const { left } = balloonPlacement(spot, balloon, VIEW);
    expect(left).toBeGreaterThanOrEqual(12);
    expect(left + balloon.width).toBeLessThanOrEqual(VIEW.width - 12 + 0.001);
  });

  it('왼쪽 끝 대상에서도 잘리지 않는다', () => {
    const spot = { top: 100, left: 4, width: 56, height: 44 };
    const { left } = balloonPlacement(spot, balloon, VIEW);
    expect(left).toBeGreaterThanOrEqual(12);
  });

  it('위아래 어디도 좁으면 화면 안에는 남는다', () => {
    // 작은 화면에서 큰 대상을 짚을 때. 말풍선이 화면 밖으로 나가면 넘길 수가 없습니다.
    const 좁은화면 = { width: 320, height: 400 };
    const spot = { top: 30, left: 10, width: 300, height: 330 };
    const { top } = balloonPlacement(spot, balloon, 좁은화면);
    expect(top).toBeGreaterThanOrEqual(12);
    expect(top + balloon.height).toBeLessThanOrEqual(좁은화면.height);
  });
});
