import { describe, it, expect } from 'vitest';
import {
  applySessionOutcomes,
  activeNotes,
  isGraduated,
  trophyFor,
  weaknessBreakdown,
  toDateKey,
  type WrongNote,
  type ItemOutcome,
} from './review';

const wrong = (refId: string, errorTypes: string[] = ['batchim']): ItemOutcome => ({
  module: 'dictation',
  refId,
  content: refId,
  correct: false,
  errorTypes,
});

const right = (refId: string): ItemOutcome => ({
  module: 'dictation',
  refId,
  content: refId,
  correct: true,
  errorTypes: [],
});

describe('오답노트: 문제 추가', () => {
  it('틀린 문제가 오답노트에 별 0개로 들어간다', () => {
    const r = applySessionOutcomes([], [wrong('가')], '2026-01-01');
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0].streak).toBe(0);
    expect(r.notes[0].wrongCount).toBe(1);
    expect(r.added).toBe(1);
  });

  it('맞힌 문제는 오답노트에 추가되지 않는다', () => {
    const r = applySessionOutcomes([], [right('가')], '2026-01-01');
    expect(r.notes).toHaveLength(0);
    expect(r.starsEarned).toBe(0);
  });

  it('이미 있는 문제를 또 틀리면 횟수만 늘고 중복 추가되지 않는다', () => {
    let notes: WrongNote[] = applySessionOutcomes([], [wrong('가')], '2026-01-01').notes;
    notes = applySessionOutcomes(notes, [wrong('가')], '2026-01-02').notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].wrongCount).toBe(2);
  });
});

describe('오답노트: 별과 졸업 (핵심 규칙)', () => {
  it('두 번 연속 맞히면 졸업한다', () => {
    let notes = applySessionOutcomes([], [wrong('가')], '2026-01-01').notes;

    const first = applySessionOutcomes(notes, [right('가')], '2026-01-02');
    notes = first.notes;
    expect(notes[0].streak).toBe(1);
    expect(first.starsEarned).toBe(1);
    expect(first.graduated).toBe(0);

    const second = applySessionOutcomes(notes, [right('가')], '2026-01-03');
    notes = second.notes;
    expect(notes[0].streak).toBe(2);
    expect(second.graduated).toBe(1);
    expect(isGraduated(notes[0])).toBe(true);
  });

  it('같은 날 두 번 맞혀도 졸업한다 — 날짜는 따지지 않는다', () => {
    // 예전 규칙에서는 두 번째 별을 주지 않았습니다.
    // 오늘 안에 오답노트를 치울 수 있어야 한다는 판단으로 그 제한을 없앴습니다.
    let notes = applySessionOutcomes([], [wrong('가')], '2026-01-01').notes;

    const first = applySessionOutcomes(notes, [right('가')], '2026-01-02');
    notes = first.notes;
    expect(notes[0].streak).toBe(1);

    const again = applySessionOutcomes(notes, [right('가')], '2026-01-02');
    expect(again.notes[0].streak).toBe(2);
    expect(again.starsEarned).toBe(1);
    expect(again.graduated).toBe(1);
  });

  it('한 세션 안에서 같은 문제를 두 번 맞혀도 별은 하나만 준다', () => {
    // 세션 안 중복은 병합해서 한 번만 반영합니다.
    // 이게 없으면 같은 문제가 두 번 나온 세션에서 한 번에 졸업해 버립니다.
    const notes = applySessionOutcomes([], [wrong('가')], '2026-01-01').notes;

    const result = applySessionOutcomes(notes, [right('가'), right('가')], '2026-01-02');
    expect(result.notes[0].streak).toBe(1);
    expect(result.starsEarned).toBe(1);
  });

  it('별을 하나 모은 뒤 틀리면 0으로 돌아간다', () => {
    let notes = applySessionOutcomes([], [wrong('가')], '2026-01-01').notes;
    notes = applySessionOutcomes(notes, [right('가')], '2026-01-02').notes;
    expect(notes[0].streak).toBe(1);

    notes = applySessionOutcomes(notes, [wrong('가')], '2026-01-03').notes;
    expect(notes[0].streak).toBe(0);
    expect(notes[0].lastCorrectDate).toBeNull();
    expect(notes[0].wrongCount).toBe(2);
  });

  it('틀린 뒤 다시 두 날에 걸쳐 맞히면 졸업할 수 있다', () => {
    let notes = applySessionOutcomes([], [wrong('가')], '2026-01-01').notes;
    notes = applySessionOutcomes(notes, [right('가')], '2026-01-02').notes;
    notes = applySessionOutcomes(notes, [wrong('가')], '2026-01-03').notes;
    notes = applySessionOutcomes(notes, [right('가')], '2026-01-04').notes;
    notes = applySessionOutcomes(notes, [right('가')], '2026-01-05').notes;
    expect(isGraduated(notes[0])).toBe(true);
  });

  it('졸업한 문제는 더 이상 별이 올라가지 않는다', () => {
    let notes = applySessionOutcomes([], [wrong('가')], '2026-01-01').notes;
    notes = applySessionOutcomes(notes, [right('가')], '2026-01-02').notes;
    notes = applySessionOutcomes(notes, [right('가')], '2026-01-03').notes;
    const extra = applySessionOutcomes(notes, [right('가')], '2026-01-04');
    expect(extra.notes[0].streak).toBe(2);
    expect(extra.starsEarned).toBe(0);
  });
});

describe('오답노트: 한 세션 안의 중복 문제', () => {
  it('같은 문제가 두 번 나와도 별은 하나만 준다', () => {
    const notes = applySessionOutcomes([], [wrong('가')], '2026-01-01').notes;
    const r = applySessionOutcomes(notes, [right('가'), right('가')], '2026-01-02');
    expect(r.notes[0].streak).toBe(1);
    expect(r.starsEarned).toBe(1);
  });

  it('같은 문제를 한 번 맞고 한 번 틀리면 틀린 것으로 처리한다', () => {
    const notes = applySessionOutcomes([], [wrong('가')], '2026-01-01').notes;
    const r = applySessionOutcomes(notes, [right('가'), wrong('가')], '2026-01-02');
    expect(r.notes[0].streak).toBe(0);
    expect(r.starsEarned).toBe(0);
  });
});

describe('오답노트: 모듈 구분', () => {
  it('받아쓰기와 맞춤법에 같은 refId가 있어도 서로 다른 문제로 취급한다', () => {
    const outcomes: ItemOutcome[] = [
      { module: 'dictation', refId: 'x', content: 'x', correct: false, errorTypes: [] },
      { module: 'spelling', refId: 'x', content: 'x', correct: false, errorTypes: [] },
    ];
    const r = applySessionOutcomes([], outcomes, '2026-01-01');
    expect(r.notes).toHaveLength(2);
  });
});

describe('오답노트: 조회 헬퍼', () => {
  const build = (): WrongNote[] => [
    { id: '1', module: 'dictation', refId: 'a', content: 'a', errorTypes: ['batchim'], streak: 0, lastCorrectDate: null, wrongCount: 1, twinRef: null, twinTries: 0, lastWrongInput: null },
    { id: '2', module: 'dictation', refId: 'b', content: 'b', errorTypes: ['spacing'], streak: 1, lastCorrectDate: '2026-01-05', wrongCount: 1, twinRef: null, twinTries: 0, lastWrongInput: null },
    { id: '3', module: 'dictation', refId: 'c', content: 'c', errorTypes: ['batchim'], streak: 2, lastCorrectDate: '2026-01-04', wrongCount: 2, twinRef: null, twinTries: 0, lastWrongInput: null },
  ];

  it('졸업하지 않은 문제만 골라낸다', () => {
    expect(activeNotes(build()).map((n) => n.refId)).toEqual(['a', 'b']);
  });

  it('오늘 별을 받았어도 연습 대상에서 빠지지 않는다', () => {
    // 날짜로 별을 막지 않으므로 '오늘 획득 가능' 목록이 따로 없습니다.
    // 아직 졸업하지 않았으면 오늘 또 맞혀서 졸업할 수 있어야 합니다.
    const todayAlreadyStarred = build()[1];
    expect(todayAlreadyStarred.lastCorrectDate).toBe('2026-01-05');
    expect(activeNotes(build()).map((n) => n.refId)).toContain('b');
  });

  it('오류 유형 빈도를 집계한다', () => {
    expect(weaknessBreakdown(build())).toEqual({ batchim: 2, spacing: 1 });
  });
});

describe('보상 판정', () => {
  it('시험 모드 100점은 금색 카드', () => {
    expect(trophyFor(100, 'exam')).toBe('gold');
  });

  it('시험 모드 90~99점은 은빛 배지', () => {
    expect(trophyFor(90, 'exam')).toBe('silver');
    expect(trophyFor(99, 'exam')).toBe('silver');
  });

  it('시험 모드 89점 이하는 보상 없음', () => {
    expect(trophyFor(89, 'exam')).toBeNull();
    expect(trophyFor(0, 'exam')).toBeNull();
  });

  it('연습 모드는 100점이어도 보상이 없다', () => {
    expect(trophyFor(100, 'practice')).toBeNull();
    expect(trophyFor(95, 'practice')).toBeNull();
  });
});

describe('날짜 키', () => {
  it('YYYY-MM-DD 형식이며 한 자리 월/일을 0으로 채운다', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});

describe('짝 문제 — 두 번째 걸음', () => {
  const 노트 = (over: Partial<WrongNote> = {}): WrongNote => ({
    id: 'dictation:닭이 울어요',
    module: 'dictation',
    refId: '닭이 울어요',
    content: '닭이 울어요',
    errorTypes: ['batchim'],
    streak: 0,
    lastCorrectDate: null,
    wrongCount: 1,
    twinRef: '흙을 만졌어요',
    twinTries: 0,
    lastWrongInput: '닥이 울어요',
    ...over,
  });

  const 결과 = (over: Partial<ItemOutcome> = {}): ItemOutcome => ({
    module: 'dictation',
    refId: '닭이 울어요',
    content: '닭이 울어요',
    correct: true,
    errorTypes: [],
    ...over,
  });

  it('짝을 맞히면 졸업하고, 다 쓴 짝은 비운다', () => {
    /*
      남겨 두면 나중에 이 문제를 또 틀렸을 때 예전에 이미 푼 짝이 다시 나옵니다.
    */
    const r = applySessionOutcomes(
      [노트({ streak: 1 })],
      [결과({ wasTwin: true, content: '흙을 만졌어요' })],
      '2026-01-10',
    );
    expect(r.graduated).toBe(1);
    expect(r.notes[0].streak).toBe(2);
    expect(r.notes[0].twinRef).toBeNull();
  });

  it('짝에서 틀리면 별이 0이 되고 **그 짝을 버린다**', () => {
    /*
      짝을 남겨 두면 다음 판에 같은 짝이 또 나옵니다.
      그러면 아이가 원본도 외우고 짝도 외워, 「같은 문장 두 번」과 다를 바가 없어집니다.
    */
    const r = applySessionOutcomes(
      [노트({ streak: 1 })],
      [결과({ correct: false, wasTwin: true, content: '흙을 만졌어요', input: '흑을 만졌어요' })],
      '2026-01-10',
    );
    expect(r.notes[0].streak).toBe(0);
    expect(r.notes[0].twinRef).toBeNull();
    expect(r.notes[0].twinTries).toBe(0);
    expect(r.notes[0].lastWrongInput).toBe('흑을 만졌어요');
  });

  it('원본에서 틀리면 짝은 그대로 둔다 — 아직 안 쓴 것이다', () => {
    // 멀쩡한 것을 버리면 만드는 값만 두 번 듭니다.
    const r = applySessionOutcomes(
      [노트({ streak: 0 })],
      [결과({ correct: false, input: '닥이 울어요' })],
      '2026-01-10',
    );
    expect(r.notes[0].streak).toBe(0);
    expect(r.notes[0].twinRef).toBe('흙을 만졌어요');
  });

  it('짝을 풀어도 **새 노트가 생기지 않는다**', () => {
    /*
      여기가 이 기능에서 제일 조심할 자리입니다.
      짝의 refId 를 보내면 그것이 독립된 오답노트가 되어 목록이 끝없이 불어납니다.
      짝은 그 노트의 두 번째 걸음이지 별개의 문제가 아닙니다.
    */
    const r = applySessionOutcomes(
      [노트({ streak: 1 })],
      [결과({ correct: false, wasTwin: true, content: '흙을 만졌어요' })],
      '2026-01-10',
    );
    expect(r.notes).toHaveLength(1);
    expect(r.added).toBe(0);
  });

  it('새로 생긴 노트는 짝이 없고, 아이가 쓴 것을 담는다', () => {
    const r = applySessionOutcomes(
      [],
      [결과({ correct: false, errorTypes: ['batchim'], input: '닥이 울어요' })],
      '2026-01-10',
    );
    expect(r.notes[0].twinRef).toBeNull();
    expect(r.notes[0].twinTries).toBe(0);
    expect(r.notes[0].lastWrongInput).toBe('닥이 울어요');
  });

  it('한 세션에서 원본과 짝을 잇달아 풀어도 별은 규칙대로 하나만 오른다', () => {
    /*
      절대 원칙 5 는 그대로입니다. 같은 문제가 한 세션에 여러 번 나와도 한 번만 반영합니다.
      두 걸음을 한 자리에서 이어 풀어도 이 규칙은 안 바뀝니다.
    */
    const r = applySessionOutcomes(
      [노트({ streak: 0 })],
      [결과(), 결과({ wasTwin: true, content: '흙을 만졌어요' })],
      '2026-01-10',
    );
    expect(r.starsEarned).toBe(1);
    expect(r.notes[0].streak).toBe(1);
  });
});
