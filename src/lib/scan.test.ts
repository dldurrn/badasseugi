import { describe, expect, it } from 'vitest';
import {
  flaggedLines,
  isBlurry,
  levelOf,
  partName,
  readGroups,
  readReview,
  reviewAfterRemove,
  reviewAfterSwap,
  reviewOrder,
  shiftReview,
  splitScan,
  type ScanReview,
} from './scan';

const review: ScanReview = {
  corrections: [
    { index: 1, from: '디근', to: '디귿', why: '' },
    { index: 3, from: '학꾜', to: '학교', why: '' },
  ],
  uncertain: [{ index: 3, why: '흐림' }, { index: 4, why: '흐림' }],
};

describe('readReview', () => {
  it('범위 밖·바뀐 것 없는 고침은 버린다', () => {
    const got = readReview(
      {
        corrections: [
          { index: 0, from: 'a', to: 'b' },
          { index: 5, from: 'a', to: 'b' },
          { index: 1, from: '같음', to: '같음' },
          { index: 1, from: 'x', to: '' },
        ],
        uncertain: [{ index: -1 }, { index: 2, why: '흐림' }, { index: 1.5 }],
      },
      3,
    );
    expect(got.corrections.map((c) => c.index)).toEqual([0]);
    expect(got.uncertain).toEqual([{ index: 2, why: '흐림' }]);
  });

  it('엉뚱한 값이 와도 빈 것으로', () => {
    expect(readReview(null, 3)).toEqual({ corrections: [], uncertain: [] });
    expect(readReview('x', 3)).toEqual({ corrections: [], uncertain: [] });
  });
});

describe('readGroups', () => {
  it('자리 순으로 줄 세우고 같은 자리·범위 밖은 버린다', () => {
    expect(
      readGroups(
        [
          { label: '4급', start: 5 },
          { label: '3급', start: 0 },
          { label: '중복', start: 5 },
          { label: '밖', start: 99 },
        ],
        8,
      ),
    ).toEqual([
      { label: '3급', start: 0 },
      { label: '4급', start: 5 },
    ]);
  });

  it('첫 묶음 앞에 걸린 문장은 제목 없는 묶음으로 남긴다 — 앞 급의 끝자락', () => {
    expect(readGroups([{ label: '3급', start: 2 }], 6)).toEqual([
      { label: '', start: 0 },
      { label: '3급', start: 2 },
    ]);
  });

  it('배열이 아니면 빈 것', () => {
    expect(readGroups(undefined, 5)).toEqual([]);
    expect(readGroups([{ label: '3급', start: 0 }], 0)).toEqual([]);
  });
});

describe('splitScan', () => {
  const sentences = ['가', '나', '다', '라', '마', '바'];

  it('묶음이 둘 미만이면 통째로 하나', () => {
    const parts = splitScan(sentences, [{ label: '3급', start: 0 }], review);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ label: '3급', sentences, review });
  });

  it('묶음마다 문장을 나누고 확인할 곳의 자리를 묶음 안으로 옮긴다', () => {
    const parts = splitScan(
      sentences,
      [
        { label: '', start: 0 },
        { label: '3급', start: 2 },
      ],
      review,
    );
    expect(parts.map((p) => p.sentences)).toEqual([['가', '나'], ['다', '라', '마', '바']]);
    expect(parts[0].review.corrections.map((c) => c.index)).toEqual([1]);
    expect(parts[1].review.corrections.map((c) => c.index)).toEqual([1]);
    expect(parts[1].review.uncertain.map((u) => u.index)).toEqual([1, 2]);
  });

  it('나눈 것을 이으면 원래 문장 그대로', () => {
    const parts = splitScan(
      sentences,
      [
        { label: '1급', start: 0 },
        { label: '2급', start: 3 },
        { label: '3급', start: 5 },
      ],
      review,
    );
    expect(parts.flatMap((p) => p.sentences)).toEqual(sentences);
  });
});

describe('목록이 바뀔 때 표시가 줄을 따라간다', () => {
  it('붙이면 앞 문장 수만큼 민다', () => {
    expect(shiftReview(review, 10).corrections.map((c) => c.index)).toEqual([11, 13]);
  });

  it('지우면 그 줄 표시는 사라지고 뒤쪽은 당겨진다', () => {
    const got = reviewAfterRemove(review, 0);
    expect(got.corrections.map((c) => [c.index, c.to])).toEqual([
      [0, '디귿'],
      [2, '학교'],
    ]);
    const gone = reviewAfterRemove(review, 3);
    expect(gone.corrections.map((c) => c.to)).toEqual(['디귿']);
    expect(gone.uncertain.map((u) => u.index)).toEqual([3]);
  });

  it('지운 뒤 되돌리기가 가리키는 줄의 문장이 고친 값과 같다', () => {
    // 맨 위 군더더기 한 줄을 지우는 흔한 경우
    let lines = ['군더더기', 'ㄷ, 디귿', '나', '학교에', '라'];
    let r: ScanReview = {
      corrections: [{ index: 3, from: '학꾜에', to: '학교에', why: '' }],
      uncertain: [],
    };
    lines = lines.filter((_, i) => i !== 0);
    r = reviewAfterRemove(r, 0);
    expect(lines[r.corrections[0].index]).toBe('학교에');
  });

  it('맞바꾸면 표시도 맞바뀐다', () => {
    const got = reviewAfterSwap(review, 1, 2);
    expect(got.corrections.map((c) => c.index)).toEqual([2, 3]);
  });

  it('짚을 줄 번호를 모은다', () => {
    expect([...flaggedLines(review)].sort()).toEqual([1, 3, 4]);
  });
});

describe('isBlurry', () => {
  it('흐린 줄이 30% 이상이면 다시 찍기를 권한다', () => {
    expect(isBlurry({ corrections: [], uncertain: [{ index: 0, why: '' }, { index: 1, why: '' }, { index: 2, why: '' }] }, 10)).toBe(true);
    expect(isBlurry({ corrections: [], uncertain: [{ index: 0, why: '' }, { index: 1, why: '' }] }, 10)).toBe(false);
  });

  it('같은 줄을 여러 번 짚어도 한 줄로 센다', () => {
    const u = [0, 0, 0].map((index) => ({ index, why: '' }));
    expect(isBlurry({ corrections: [], uncertain: u }, 5)).toBe(false);
  });

  it('세 줄 미만은 따지지 않는다', () => {
    expect(isBlurry({ corrections: [], uncertain: [{ index: 0, why: '' }] }, 2)).toBe(false);
  });
});

describe('확인할 차례', () => {
  it('이름에서 급 번호를 읽는다', () => {
    expect(levelOf('3급')).toBe(3);
    expect(levelOf('받아쓰기 12급')).toBe(12);
    expect(levelOf('2학년 5급')).toBe(5);
    expect(levelOf('10월 27일 받아쓰기')).toBe(10);
    expect(levelOf('봄 문제')).toBe(Number.POSITIVE_INFINITY);
  });

  it('급 번호 → 만든 순서로 줄 세운다', () => {
    const sets = [
      { name: '10급', createdAt: '2026-10-01' },
      { name: '2급', createdAt: '2026-10-01' },
      { name: '이름 없음', createdAt: '2026-09-01' },
      { name: '2급', createdAt: '2026-09-01' },
    ];
    expect(reviewOrder(sets).map((s) => `${s.name}@${s.createdAt}`)).toEqual([
      '2급@2026-09-01',
      '2급@2026-10-01',
      '10급@2026-10-01',
      '이름 없음@2026-09-01',
    ]);
  });

  it('제목 없는 묶음은 기본 이름에 번호를 붙인다', () => {
    const empty = { corrections: [], uncertain: [] };
    expect(partName({ label: '3급', sentences: [], review: empty }, 1, '받아쓰기')).toBe('3급');
    expect(partName({ label: '', sentences: [], review: empty }, 0, '받아쓰기')).toBe('받아쓰기 (1)');
  });
});
