import { describe, expect, it } from 'vitest';
import {
  MAX_BULK_SETS,
  hiddenLabel,
  isHiddenFor,
  parseVisibilityRequest,
  visibleCount,
  withHidden,
} from './visibility';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const S1 = '33333333-3333-4333-8333-333333333333';
const S2 = '44444444-4444-4444-8444-444444444444';

describe('기본은 모두에게 보임', () => {
  it('숨긴 아이가 없으면 누구에게나 보입니다', () => {
    expect(isHiddenFor([], A)).toBe(false);
    expect(isHiddenFor([], B)).toBe(false);
  });

  it('숨긴 아이에게만 숨겨집니다', () => {
    expect(isHiddenFor([A], A)).toBe(true);
    expect(isHiddenFor([A], B)).toBe(false);
  });

  it('보호자 화면(아이 없음)에서는 숨겨지지 않습니다', () => {
    expect(isHiddenFor([A, B], null)).toBe(false);
  });

  it('나중에 추가된 아이는 기존 숨김 목록에 없으므로 보입니다', () => {
    const NEW = '55555555-5555-4555-8555-555555555555';
    expect(isHiddenFor([A], NEW)).toBe(false);
  });
});

describe('withHidden', () => {
  it('숨기고 다시 보이게 합니다', () => {
    expect(withHidden([], A, true)).toEqual([A]);
    expect(withHidden([A], A, false)).toEqual([]);
  });

  it('이미 그 상태면 그대로입니다(중복으로 쌓이지 않습니다)', () => {
    expect(withHidden([A], A, true)).toEqual([A]);
    expect(withHidden([], A, false)).toEqual([]);
  });

  it('다른 아이는 건드리지 않습니다', () => {
    expect(withHidden([A], B, true)).toEqual([A, B]);
    expect(withHidden([A, B], A, false)).toEqual([B]);
  });

  it('원래 배열을 바꾸지 않습니다', () => {
    const before = [A];
    withHidden(before, B, true);
    expect(before).toEqual([A]);
  });
});

describe('visibleCount', () => {
  const sets = [{ hiddenFor: [] }, { hiddenFor: [A] }, { hiddenFor: [A, B] }];
  it('아이마다 따로 셉니다', () => {
    expect(visibleCount(sets, A)).toBe(1);
    expect(visibleCount(sets, B)).toBe(2);
  });
  it('세트가 없으면 0', () => {
    expect(visibleCount([], A)).toBe(0);
  });
});

describe('hiddenLabel', () => {
  const kids = [
    { id: A, nickname: '하나' },
    { id: B, nickname: '둘' },
  ];
  it('숨긴 아이가 없으면 null', () => {
    expect(hiddenLabel([], kids)).toBeNull();
  });
  it('이름을 적습니다', () => {
    expect(hiddenLabel([B], kids)).toBe('둘에게는 안 보여요');
  });
  it('모두에게 숨기면 그렇게 말합니다', () => {
    expect(hiddenLabel([A, B], kids)).toBe('아무에게도 안 보여요');
  });
  it('지워진 아이의 id 는 무시합니다', () => {
    expect(hiddenLabel(['66666666-6666-4666-8666-666666666666'], kids)).toBeNull();
  });
});

describe('parseVisibilityRequest', () => {
  it('올바른 요청을 받습니다', () => {
    expect(parseVisibilityRequest({ childId: A, setIds: [S1, S2], hidden: true })).toEqual({
      childId: A,
      setIds: [S1, S2],
      hidden: true,
    });
  });

  it('중복 id 는 접습니다', () => {
    expect(parseVisibilityRequest({ childId: A, setIds: [S1, S1], hidden: false })?.setIds).toEqual([
      S1,
    ]);
  });

  it.each([
    ['null', null],
    ['문자열', 'x'],
    ['childId 없음', { setIds: [S1], hidden: true }],
    ['childId 모양 아님', { childId: 'abc', setIds: [S1], hidden: true }],
    ['hidden 이 불리언 아님', { childId: A, setIds: [S1], hidden: 'yes' }],
    ['setIds 비어 있음', { childId: A, setIds: [], hidden: true }],
    ['setIds 배열 아님', { childId: A, setIds: S1, hidden: true }],
    ['내장 세트 id 같은 uuid 아닌 값', { childId: A, setIds: ['lv1'], hidden: true }],
    ['숫자 섞임', { childId: A, setIds: [S1, 3], hidden: true }],
  ])('거절: %s', (_name, body) => {
    expect(parseVisibilityRequest(body)).toBeNull();
  });

  it('상한을 넘으면 거절합니다', () => {
    const many = Array.from({ length: MAX_BULK_SETS + 1 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    expect(parseVisibilityRequest({ childId: A, setIds: many, hidden: true })).toBeNull();
  });
});
