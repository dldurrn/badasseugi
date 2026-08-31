import type { ItemOutcome } from './review';
import type { Mode, Module } from './types';

/**
 * 오답 이력 — **틀린 사건을 한 줄씩** 쌓습니다.
 *
 * 오답노트(`wrong_notes`)는 문제마다 한 줄이고 그 줄이 계속 덮어써집니다.
 * 「지금 상태」는 알지만 「일어난 일」은 남지 않아, 리포트가
 * **나아짐을 영영 못 보여 줍니다** — 아이가 열심히 할수록 막대는 길어지기만 합니다.
 *
 * 여기는 그 반대입니다. 한 번 쌓인 줄은 안 바뀌고 안 지워집니다.
 *
 * **틀린 것만 쌓습니다.** 받아쓰기에서 오류 유형은 틀렸을 때만 생기고,
 * 분모(푼 문제 수)는 이미 `attempts.total_count` 에 있습니다.
 * 맞힌 것까지 저장할 까닭이 없습니다 — 아이 정보는 적을수록 좋습니다(절대 원칙 7).
 */

/** DB 칸 이름 그대로. 이 파일 밖에서는 만들지 않습니다. */
export interface WrongEventRow {
  child_id: string;
  attempt_id: string | null;
  module: Module;
  mode: Mode;
  source: 'session' | 'review';
  ref_id: string;
  content: string;
  input: string | null;
  error_types: string[];
}

/** 아이가 쓴 것도 받아쓰기 한 문장을 넘을 수 없습니다. */
const MAX_TEXT = 200;

export function buildWrongEvents(o: {
  childId: string;
  /** 정규 세션이면 방금 만든 attempts 행의 id, 복습이면 null */
  attemptId: string | null;
  module: Module;
  mode: Mode;
  outcomes: ItemOutcome[];
}): WrongEventRow[] {
  return o.outcomes
    .filter((item) => !item.correct)
    .map((item) => ({
      child_id: o.childId,
      attempt_id: o.attemptId,
      module: o.module,
      mode: o.mode,
      /*
        attempts 에 남았으면 정규 세션, 안 남았으면 오답노트 복습입니다.
        복습은 분모(푼 문제 수)가 없어서, 섞으면 오답률이 부풀어 보입니다.
      */
      source: o.attemptId ? ('session' as const) : ('review' as const),
      ref_id: item.refId.slice(0, MAX_TEXT),
      /*
        그때의 문제를 그대로 박아 둡니다.
        받아쓰기는 ref_id 가 문장 원문이라, 부모가 세트를 고치면 옛 사건이 미아가 됩니다.
        짝 문제를 푼 것이면 여기 짝 문장이 들어갑니다 — 그게 실제로 푼 것이니까요.
      */
      content: item.content.slice(0, MAX_TEXT),
      input: typeof item.input === 'string' ? item.input.slice(0, MAX_TEXT) : null,
      error_types: item.errorTypes.slice(0, 8),
    }));
}
