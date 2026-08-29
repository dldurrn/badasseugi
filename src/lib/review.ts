/**
 * 오답노트 복습 규칙
 *
 * 규칙 (CLAUDE.md 절대 원칙 5)
 * - 같은 문제를 "연속 2회" 맞히면 졸업한다. 날짜는 따지지 않는다.
 * - 두 번을 요구하는 이유는 시간 간격이 아니라 찍어서 맞힌 것을 거르기 위해서다.
 *   (2지선다를 연속 두 번 맞힐 확률은 25%)
 * - 한 번이라도 틀리면 별은 0으로 돌아간다.
 * - 세션을 끝까지 마쳤을 때만 이 함수를 호출한다. 중도 이탈 시 호출하지 않는다.
 *
 * 예전에는 "서로 다른 날짜"를 요구했다. 같은 날 반복은 단기기억이라는 이유였는데,
 * 아이가 오늘 아무리 해도 진도가 안 나가는 쪽의 손해가 더 컸다.
 * `lastCorrectDate`는 지금도 기록하지만 별을 막는 데 쓰지 않는다 —
 * "오늘 별을 받았어요" 같은 안내에만 쓴다.
 *
 * 순수 함수로 작성되어 있어 DB 없이도 검증할 수 있습니다.
 */

export const STARS_TO_GRADUATE = 2;

export interface WrongNote {
  id: string;
  module: 'dictation' | 'spelling';
  /** 받아쓰기는 문장 원문, 맞춤법은 문제 은행 id */
  refId: string;
  content: string;
  errorTypes: string[];
  /** 현재 모은 별 개수 (0 ~ 2) */
  streak: number;
  /** 마지막으로 별을 얻은 날짜 (YYYY-MM-DD). 아직 없으면 null */
  lastCorrectDate: string | null;
  wrongCount: number;

  /**
   * 짝 문제의 식별자. `refId` 와 같은 규칙입니다 —
   * 받아쓰기는 문장 원문, 맞춤법은 문제은행 문항 id.
   *
   * 비어 있으면 아직 못 만들었거나 만들다 실패한 것입니다.
   * 그때는 예전처럼 **원본을 두 번** 풀어 졸업합니다(`stepOf`).
   */
  twinRef: string | null;
  /** 짝을 만들어 보려 한 횟수. 될 리 없는 것을 계속 만들지 않기 위해 */
  twinTries: number;
  /** 아이가 마지막으로 잘못 쓴 것. 좋은 짝을 만들 때와 리포트에 씁니다 */
  lastWrongInput: string | null;
}

/** 한 문제에 대한 세션 결과 */
export interface ItemOutcome {
  module: 'dictation' | 'spelling';
  /**
   * **언제나 원본 노트의 식별자**입니다.
   *
   * 짝을 풀 때도 원본의 refId 를 보냅니다. 짝의 것을 보내면
   * `applySessionOutcomes` 가 그것을 **새 오답노트로 만들어 버립니다** —
   * 그러면 노트가 끝없이 불어나 「치울 수 있는 목록」이 아니게 됩니다.
   * 짝은 그 노트의 두 번째 걸음이지 독립된 문제가 아닙니다.
   */
  refId: string;
  content: string;
  correct: boolean;
  errorTypes: string[];
  /** 짝을 푼 결과인가. 별 규칙은 같고, 틀렸을 때 짝을 버릴지가 갈립니다 */
  wasTwin?: boolean;
  /** 아이가 실제로 쓴 것. 다음 짝을 만들 때 씁니다 */
  input?: string;
}

export interface ApplyResult {
  notes: WrongNote[];
  /** 이번 세션에서 새로 별을 얻은 문제 수 */
  starsEarned: number;
  /** 이번 세션에서 졸업한 문제 수 */
  graduated: number;
  /** 이번 세션에서 새로 오답노트에 추가된 문제 수 */
  added: number;
}

/** YYYY-MM-DD 형식의 로컬 날짜 문자열. */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 서비스 기준 날짜(한국 시간).
 *
 * 서버가 UTC로 도는 곳(Vercel)에서 `toDateKey()`를 그대로 쓰면
 * 아침 9시 이전에 푼 기록이 '어제'로 남습니다.
 * 그러면 "서로 다른 날 두 번"이라는 규칙이 실제와 어긋나므로,
 * 별 판정에는 반드시 이 함수를 씁니다.
 */
export function toDateKeyInSeoul(d: Date = new Date()): string {
  // en-CA 로케일이 YYYY-MM-DD 형식을 그대로 돌려줍니다.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * 한국 기준 그 주의 월요일 날짜(YYYY-MM-DD).
 *
 * 리포트의 "이번 주"는 오늘부터 7일 거슬러가 아니라 달력의 월~일이어야 합니다.
 * 부모가 머릿속으로 세는 주와 화면이 어긋나면 숫자를 믿기 어려워집니다.
 */
export function seoulWeekStart(d: Date = new Date()): string {
  const [y, m, day] = toDateKeyInSeoul(d).split('-').map(Number);
  // 한국 달력 날짜를 그대로 UTC에 넣으면 요일이 일치합니다.
  const base = new Date(Date.UTC(y, m - 1, day));
  const fromMonday = (base.getUTCDay() + 6) % 7; // 월=0 … 일=6
  base.setUTCDate(base.getUTCDate() - fromMonday);
  return base.toISOString().slice(0, 10);
}

/** 별 2개를 다 모았으면 졸업. */
export function isGraduated(note: Pick<WrongNote, 'streak'>): boolean {
  return note.streak >= STARS_TO_GRADUATE;
}

/**
 * 한 세션의 결과를 오답노트에 반영합니다.
 *
 * 중요: 같은 문제가 한 세션에 여러 번 나와도 한 번만 반영합니다.
 * (하나라도 틀렸으면 틀린 것으로 처리)
 *
 * @param notes  현재 오답노트 (변경하지 않고 새 배열을 반환)
 * @param outcomes 이번 세션에서 푼 문제들의 결과
 * @param today  오늘 날짜 키. 테스트에서 주입할 수 있도록 인자로 받습니다.
 */
export function applySessionOutcomes(
  notes: WrongNote[],
  outcomes: ItemOutcome[],
  today: string = toDateKey(),
): ApplyResult {
  // 1) 같은 문제 중복 제거 — 하나라도 틀렸으면 틀림으로 병합
  const merged = new Map<string, ItemOutcome>();
  for (const o of outcomes) {
    const key = `${o.module}:${o.refId}`;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...o, errorTypes: [...o.errorTypes] });
    } else {
      prev.correct = prev.correct && o.correct;
      prev.errorTypes = Array.from(new Set([...prev.errorTypes, ...o.errorTypes]));
      // 한 세션에 원본과 짝을 잇달아 풀면 둘 다 여기로 옵니다.
      // 짝을 풀었다는 사실과 마지막으로 쓴 것은 나중 것을 남깁니다.
      prev.wasTwin = prev.wasTwin || o.wasTwin;
      if (o.input !== undefined) prev.input = o.input;
    }
  }

  const next = notes.map((n) => ({ ...n, errorTypes: [...n.errorTypes] }));
  let starsEarned = 0;
  let graduated = 0;
  let added = 0;

  for (const [, outcome] of merged) {
    const idx = next.findIndex(
      (n) => n.module === outcome.module && n.refId === outcome.refId,
    );

    if (outcome.correct) {
      if (idx === -1) continue; // 오답노트에 없던 문제를 맞힘 — 할 일 없음
      const note = next[idx];
      if (isGraduated(note)) continue; // 이미 졸업

      note.streak += 1;
      note.lastCorrectDate = today;
      starsEarned += 1;
      /*
        짝까지 맞혔으면 졸업입니다. 다 쓴 짝은 비웁니다 —
        남겨 두면 나중에 이 문제를 또 틀렸을 때 **예전에 이미 푼 짝**이 다시 나옵니다.
      */
      if (isGraduated(note)) {
        graduated += 1;
        note.twinRef = null;
        note.twinTries = 0;
      }
      continue;
    }

    // 오답
    if (idx === -1) {
      next.push({
        id: `${outcome.module}:${outcome.refId}`,
        module: outcome.module,
        refId: outcome.refId,
        content: outcome.content,
        errorTypes: [...outcome.errorTypes],
        streak: 0,
        lastCorrectDate: null,
        wrongCount: 1,
        twinRef: null,
        twinTries: 0,
        lastWrongInput: outcome.input ?? null,
      });
      added += 1;
    } else {
      const note = next[idx];
      note.streak = 0;
      note.lastCorrectDate = null;
      note.wrongCount += 1;
      note.errorTypes = Array.from(
        new Set([...note.errorTypes, ...outcome.errorTypes]),
      );
      if (outcome.input !== undefined) note.lastWrongInput = outcome.input;

      /*
        **짝에서 틀렸으면 그 짝을 버립니다.**

        남겨 두면 다음 판에 같은 짝이 또 나옵니다. 그러면 아이가 원본도 외우고
        짝도 외우게 되어, 「같은 문장 두 번」과 다를 바가 없어집니다.
        원본에서 틀렸을 때는 짝이 아직 안 쓰였으니 그대로 둡니다 —
        멀쩡한 것을 버리면 만드는 값만 두 번 듭니다.
      */
      if (outcome.wasTwin) {
        note.twinRef = null;
        note.twinTries = 0;
      }
    }
  }

  return { notes: next, starsEarned, graduated, added };
}

/** 아직 졸업하지 않아 연습이 필요한 문제들. */
export function activeNotes(notes: WrongNote[]): WrongNote[] {
  return notes.filter((n) => !isGraduated(n));
}

/*
 * `notesEligibleToday()`는 없앴습니다.
 * 날짜로 별을 막지 않게 되면서 "오늘 별을 받을 수 있는 문제"가
 * 곧 "아직 졸업하지 않은 문제"와 같아졌습니다. `activeNotes()`를 쓰세요.
 */

/** 리포트용 — 오류 유형별 빈도 집계. */
export function weaknessBreakdown(notes: WrongNote[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const n of notes) {
    for (const t of n.errorTypes) {
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }
  return counts;
}

/** 보상 판정 — 시험 모드를 끝까지 마쳤을 때만 호출합니다. */
export type TrophyKind = 'gold' | 'silver' | null;

export function trophyFor(score: number, mode: 'practice' | 'exam'): TrophyKind {
  if (mode !== 'exam') return null; // 연습 모드는 보상 없음
  if (score >= 100) return 'gold';
  if (score >= 90) return 'silver';
  return null;
}
