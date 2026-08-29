import type { SpellingKind } from '@/data/spelling-bank';
import type { Mode, Module } from '@/lib/types';

/**
 * 세션 저장 규약 — 화면과 서버가 함께 쓰는 타입.
 *
 * 저장은 **세션을 끝까지 마쳤을 때 한 번만** 일어납니다(절대 원칙 2).
 * 그래서 문제를 풀 때마다 보내지 않고, 마지막에 결과 전체를 한 번에 보냅니다.
 * 중간에 나가면 아무것도 보내지 않으므로 기록이 남지 않습니다.
 *
 * 점수는 서버가 outcomes로 다시 계산합니다. 화면이 보낸 점수는 믿지 않습니다.
 */

export interface OutcomePayload {
  /**
   * 오답노트 참조용 — 받아쓰기는 문장 원문, 맞춤법은 문제 id.
   * **짝 문제를 풀 때도 원본의 것을 보냅니다.** 짝의 것을 보내면 그것이
   * 새 오답노트가 되어 목록이 끝없이 불어납니다.
   */
  refId: string;
  content: string;
  correct: boolean;
  errorTypes: string[];
  /** 짝 문제를 푼 결과인가. 틀렸을 때 그 짝을 버릴지가 갈립니다 */
  wasTwin?: boolean;
  /** 아이가 실제로 쓴 것. 다음 짝을 겨눠 만들 때 씁니다 */
  input?: string;
}

export interface CompleteSessionRequest {
  childId: string;
  module: Module;
  mode: Mode;
  setId?: string | null;
  /**
   * 앱 내장 세트를 풀었을 때의 id (`g1-1-1` 형태).
   * `sets` 테이블에 행이 없어 `setId`를 쓸 수 없으므로 따로 받습니다.
   */
  builtinSetId?: string | null;
  spellingKind?: SpellingKind | null;
  /** 보상 카드에 적을 출처 이름 (세트 이름 등) */
  sourceName?: string | null;
  outcomes: OutcomePayload[];
  /**
   * 풀이 기록(attempts)에 남길지. 기본값은 남깁니다.
   *
   * 오답노트에서 한 문제만 그 자리에서 푸는 경우에만 false를 씁니다.
   * 그건 '세션'이 아니라 복습 한 번이라, 기록에 남기면
   * 0점/100점짜리 한 문제 기록이 쌓여 리포트의 평균 점수가 흔들립니다.
   * 오답노트 갱신(별·졸업)은 이 값과 무관하게 언제나 일어납니다.
   */
  logAttempt?: boolean;
}

export interface EarnedTrophy {
  kind: 'gold' | 'silver';
  emblem: string;
  label: string | null;
}

export interface CompleteSessionResponse {
  score: number;
  correctCount: number;
  totalCount: number;
  /** 시험 모드를 끝까지 마쳤을 때만 값이 있습니다. 연습 모드는 언제나 null. */
  trophy: EarnedTrophy | null;
  /** 이번에 새로 받은 별 */
  starsEarned: number;
  /** 이번에 졸업한 문제 수 */
  graduated: number;
  /** 오답노트에 새로 들어간 문제 수 */
  added: number;
}

export const MAX_OUTCOMES = 100;
