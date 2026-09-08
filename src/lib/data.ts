import { DICTATION_BANK, findBuiltinSet, isBuiltinSetId } from '@/data/dictation-bank';
import { hasChoices } from '@/lib/choices';
import { createClient } from '@/lib/supabase/server';
import { seoulWeekStart, toDateKeyInSeoul, type WrongNote } from '@/lib/review';
import { buildTracks, daysIntoWeek, type Track } from '@/lib/report';
import type { Mode, Module } from '@/lib/types';

/**
 * 화면이 쓰는 읽기 질의 모음.
 *
 * RLS가 가족 단위로 걸려 있어서 where 절에 family_id를 다시 쓰지 않아도 됩니다.
 * 자녀 단위 구분이 필요한 곳에만 child_id를 명시합니다.
 *
 * 집계는 SQL 대신 JS에서 합니다. 한 아이가 쌓는 기록이 많아야 수백 행이라
 * 뷰나 함수를 따로 두는 것보다 읽고 고치기 쉬운 편이 낫습니다.
 */

/* ---------------------------------------------------------------- 세트 */

export interface SetSummary {
  id: string;
  name: string;
  count: number;
  createdAt: string;
  /** 이 자녀의 최고 점수. 아직 안 풀었으면 null */
  best: number | null;
  /**
   * 「듣고 고르기」로 풀 것이 하나라도 있는가.
   *
   * 목록에서 버튼을 그릴지 정하는 데 씁니다. 눌러 봐야 「고를 것이 없어요」가
   * 나오는 버튼을 만들지 않으려는 것이고, 세트 상세 화면과 같은 판정입니다.
   */
  hasChoice: boolean;
}

export async function listSets(childId: string | null): Promise<SetSummary[]> {
  const supabase = await createClient();

  /*
    문장을 함께 받아 옵니다.

    예전에는 `set_items(count)` 로 개수만 셌는데, 목록에서 「듣고 고르기」 버튼을
    그릴지 정하려면 문장이 있어야 합니다. 개수를 따로 세고 문장을 또 물으면
    **도쿄를 두 번 왕복**하므로, 한 번에 받아 여기서 둘 다 셈합니다.
    한 집의 문장은 다 합쳐야 몇 킬로바이트라 왕복 한 번보다 쌉니다.
  */
  const { data: sets } = await supabase
    .from('sets')
    .select('id, name, created_at, set_items(sentence)')
    .order('created_at', { ascending: false });

  if (!sets) return [];

  const bestBySet = new Map<string, number>();
  if (childId) {
    const { data: attempts } = await supabase
      .from('attempts')
      .select('set_id, score')
      .eq('child_id', childId)
      .eq('module', 'dictation')
      .not('set_id', 'is', null);

    for (const row of attempts ?? []) {
      const setId = row.set_id as string;
      const score = row.score as number;
      const prev = bestBySet.get(setId);
      if (prev === undefined || score > prev) bestBySet.set(setId, score);
    }
  }

  return sets.map((row) => {
    const items = (row.set_items as unknown as Array<{ sentence: string }> | null) ?? [];
    const sentences = items.map((it) => it.sentence);
    return {
      id: row.id as string,
      name: row.name as string,
      createdAt: row.created_at as string,
      count: sentences.length,
      best: bestBySet.get(row.id as string) ?? null,
      hasChoice: sentences.some(hasChoices),
    };
  });
}

export interface SetDetail {
  id: string;
  name: string;
  sentences: string[];
  /** 앱이 미리 갖고 있는 기본 문제인지. 이건 부모가 고칠 수 없습니다. */
  builtin: boolean;
}

export async function getSet(id: string): Promise<SetDetail | null> {
  // 내장 세트를 먼저 봅니다. id 모양이 uuid가 아니라 DB에 물어봐야 오류만 납니다.
  if (isBuiltinSetId(id)) {
    const found = findBuiltinSet(id);
    return found
      ? { id: found.id, name: found.name, sentences: found.sentences, builtin: true }
      : null;
  }

  const supabase = await createClient();

  const { data: set } = await supabase.from('sets').select('id, name').eq('id', id).maybeSingle();
  if (!set) return null;

  const { data: items } = await supabase
    .from('set_items')
    .select('sentence, order_index')
    .eq('set_id', id)
    .order('order_index', { ascending: true });

  return {
    id: set.id as string,
    name: set.name as string,
    sentences: (items ?? []).map((i) => i.sentence as string),
    builtin: false,
  };
}

/**
 * 오늘 바로 시작할 것 하나.
 *
 * 아이는 앱을 열 때마다 **홈 → 받아쓰기 → 스물세 장에서 세트 찾기**를 되풀이합니다.
 * 매일 하는 일인데 매일 찾습니다. 홈에 한 장을 놓아 그 훑기를 없앱니다.
 *
 * **새 갈래를 만드는 게 아니라 있는 갈래로 더 빨리 가는 것입니다.**
 * 그래서 화면도 목록과 **같은 카드**(`DictationSetCard`)를 씁니다 —
 * 여기서만 다르게 생기면 아이가 두 벌을 익혀야 합니다.
 *
 * 고르는 차례:
 *  1. **부모가 넣었는데 아직 한 번도 안 푼 것.** 학교에서 받아온 문제지가 오늘 할 일입니다.
 *  2. 없으면 **아직 안 푼 가장 낮은 단계.** 「마지막에 풀던 것」이 아니라 **다음 것**입니다 —
 *     3단계를 100점으로 끝낸 아이에게 3단계를 다시 권하면 앞으로 나아가지 않습니다.
 *  3. 둘 다 없으면 null. 홈은 지금까지처럼 그립니다.
 *
 * 「듣고 고르기」로만 푼 것은 기록이 없어 계속 「안 푼 것」으로 남습니다. 그게 맞습니다 —
 * 점수를 남기지 않는 모드라 「했다」고 셀 근거가 없습니다.
 */
export interface NextUp {
  id: string;
  name: string;
  detail: string;
  hasChoice: boolean;
  /** 왜 골랐나. 화면의 제목이 갈립니다 */
  reason: 'new' | 'next';
}

export async function getNextUp(childId: string): Promise<NextUp | null> {
  // 둘을 나란히 부릅니다. 줄 세우면 도쿄를 두 번 다녀오는 시간이 그대로 쌓입니다.
  const [sets, builtinBest] = await Promise.all([
    listSets(childId),
    builtinBestScores(childId),
  ]);

  // listSets 는 새로 만든 것부터 줍니다. `best === null` 이 「아직 안 풀었다」입니다.
  const 새것 = sets.find((s) => s.best === null && s.count > 0);
  if (새것) {
    return {
      id: 새것.id,
      name: 새것.name,
      detail: `문장 ${새것.count}개`,
      hasChoice: 새것.hasChoice,
      reason: 'new',
    };
  }

  const 다음단계 = DICTATION_BANK.find((s) => !builtinBest.has(s.id));
  if (다음단계) {
    return {
      id: 다음단계.id,
      name: 다음단계.name,
      detail: `${다음단계.focus} · ${다음단계.sentences.length}개`,
      hasChoice: 다음단계.sentences.some(hasChoices),
      reason: 'next',
    };
  }

  return null;
}

/**
 * 내장 세트의 자녀별 최고 점수.
 *
 * 부모 세트는 `attempts.set_id`, 내장 세트는 `attempts.builtin_set_id`에 남습니다.
 * 컬럼이 다른 것은 내장 세트가 `sets` 테이블에 없어 외래키를 걸 수 없기 때문입니다.
 */
export async function builtinBestScores(
  childId: string | null,
): Promise<Map<string, number>> {
  const best = new Map<string, number>();
  if (!childId) return best;

  const supabase = await createClient();
  const { data } = await supabase
    .from('attempts')
    .select('builtin_set_id, score')
    .eq('child_id', childId)
    .not('builtin_set_id', 'is', null);

  for (const row of data ?? []) {
    const key = row.builtin_set_id as string;
    const score = row.score as number;
    const prev = best.get(key);
    if (prev === undefined || score > prev) best.set(key, score);
  }
  return best;
}

/* ------------------------------------------------------------ 오답노트 */

export async function listWrongNotes(
  childId: string,
  module?: Module,
): Promise<WrongNote[]> {
  const supabase = await createClient();

  let query = supabase
    .from('wrong_notes')
    .select(
      'id, module, ref_id, content, error_types, streak, last_correct_date, wrong_count, twin_ref, twin_tries, last_wrong_input',
    )
    .eq('child_id', childId)
    .order('updated_at', { ascending: false });

  if (module) query = query.eq('module', module);

  const { data } = await query;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    module: row.module as Module,
    refId: row.ref_id as string,
    content: row.content as string,
    errorTypes: (row.error_types as string[] | null) ?? [],
    streak: (row.streak as number | null) ?? 0,
    lastCorrectDate: (row.last_correct_date as string | null) ?? null,
    wrongCount: (row.wrong_count as number | null) ?? 1,
    twinRef: (row.twin_ref as string | null) ?? null,
    twinTries: (row.twin_tries as number | null) ?? 0,
    lastWrongInput: (row.last_wrong_input as string | null) ?? null,
  }));
}

/* ---------------------------------------------------------------- 보상 */

export interface TrophyRow {
  id: string;
  kind: 'gold' | 'silver';
  emblem: string;
  label: string | null;
  score: number;
  createdAt: string;
}

export async function listTrophies(childId: string): Promise<TrophyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('trophies')
    .select('id, kind, emblem, label, score, created_at')
    .eq('child_id', childId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.kind as 'gold' | 'silver',
    emblem: row.emblem as string,
    label: row.label as string | null,
    score: row.score as number,
    createdAt: row.created_at as string,
  }));
}

/* ------------------------------------------------------------- 홈 요약 */

export interface HomeSummary {
  /** 오늘 푼 세션. 아직 없으면 null */
  today: { count: number; average: number } | null;
  activeNotes: number;
  trophyCount: number;
}

export async function getHomeSummary(childId: string): Promise<HomeSummary> {
  const supabase = await createClient();
  const todayKey = toDateKeyInSeoul();

  // 하루치만 보면 되지만, 시간대 경계를 정확히 자르려고 이틀치를 읽고 JS에서 거릅니다.
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: attempts }, { count: noteCount }, { count: trophyCount }] = await Promise.all([
    supabase
      .from('attempts')
      .select('score, created_at')
      .eq('child_id', childId)
      .gte('created_at', since),
    supabase
      .from('wrong_notes')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .lt('streak', 2),
    supabase
      .from('trophies')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId),
  ]);

  const todays = (attempts ?? []).filter(
    (a) => toDateKeyInSeoul(new Date(a.created_at as string)) === todayKey,
  );

  return {
    today:
      todays.length === 0
        ? null
        : {
            count: todays.length,
            average: Math.round(
              todays.reduce((sum, a) => sum + (a.score as number), 0) / todays.length,
            ),
          },
    activeNotes: noteCount ?? 0,
    trophyCount: trophyCount ?? 0,
  };
}

/* -------------------------------------------------------------- 리포트 */

export interface AttemptRow {
  id: string;
  module: Module;
  mode: Mode;
  score: number;
  correctCount: number;
  totalCount: number;
  createdAt: string;
}

export interface ReportData {
  /** 이번 달력 주(월~일)에 한 번이라도 푼 날 수 */
  daysPracticed: number;
  /**
   * 이번 주가 며칠째인가(1~7).
   *
   * 「3일」만 보여 주면 수요일의 3일과 일요일의 3일이 같아 보입니다 —
   * 앞의 것은 하루도 안 빠진 것이고 뒤의 것은 나흘을 쉰 것인데요.
   */
  daysElapsed: number;
  problemsSolved: number;
  /**
   * 갈래(과목 × 방식)별 최근 4주 평균.
   *
   * 하나의 평균으로 뭉개면 **견줄 수 없는 것을 견주게 됩니다** —
   * 받아쓰기 20단계 시험과 맞춤법 1단계 연습이 같은 숫자에 들어갔습니다.
   * 기록이 있는 갈래만 옵니다.
   */
  tracks: Track[];
  recent: AttemptRow[];
  /** 받아쓰기 오답의 오류 유형 분포 */
  dictationWeakness: Array<[string, number]>;
  /** 맞춤법 오답의 헷갈리는 말 분포 */
  spellingWeakness: Array<[string, number]>;
  activeNoteCount: number;
  graduatedCount: number;
}

const DAY = 24 * 60 * 60 * 1000;

export async function getReport(childId: string): Promise<ReportData> {
  const supabase = await createClient();
  // 달력 주로 자르면 3주 전 월요일이 최대 27일 전입니다. 여유를 두고 35일치를 읽습니다.
  const since = new Date(Date.now() - 35 * DAY).toISOString();

  const { data: attemptRows } = await supabase
    .from('attempts')
    .select('id, module, mode, score, correct_count, total_count, created_at')
    .eq('child_id', childId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  const attempts: AttemptRow[] = (attemptRows ?? []).map((row) => ({
    id: row.id as string,
    module: row.module as Module,
    mode: row.mode as Mode,
    score: row.score as number,
    correctCount: (row.correct_count as number | null) ?? 0,
    totalCount: row.total_count as number,
    createdAt: row.created_at as string,
  }));

  // 달력 주(월~일) 기준으로 묶습니다. 부모가 세는 주와 화면이 같아야 합니다.
  const byWeek = new Map<string, AttemptRow[]>();
  for (const attempt of attempts) {
    const key = seoulWeekStart(new Date(attempt.createdAt));
    const bucket = byWeek.get(key);
    if (bucket) bucket.push(attempt);
    else byWeek.set(key, [attempt]);
  }

  const currentWeek = seoulWeekStart();
  const thisWeek = byWeek.get(currentWeek) ?? [];

  const days = new Set(thisWeek.map((a) => toDateKeyInSeoul(new Date(a.createdAt))));
  const problemsSolved = thisWeek.reduce((sum, a) => sum + a.totalCount, 0);

  /*
    갈래별로 나눠 셉니다. 예전에는 여기서 전부 한 평균을 냈는데,
    그러면 과목도 방식도 난이도도 안 가린 숫자가 리포트에서 가장 크게 떴습니다.
    셈은 report.ts 가 합니다 — 화면도 DB도 모르는 순수 함수라 테스트로 지킵니다.
  */
  const weekStarts = [3, 2, 1, 0].map((weeksAgo) =>
    seoulWeekStart(new Date(Date.now() - weeksAgo * 7 * DAY)),
  );
  const weekLabels = ['3주 전', '2주 전', '지난주', '이번 주'];
  const tracks = buildTracks(
    attempts.map((a) => ({
      module: a.module,
      mode: a.mode,
      score: a.score,
      weekStart: seoulWeekStart(new Date(a.createdAt)),
    })),
    weekStarts,
    weekLabels,
  );

  const notes = await listWrongNotes(childId);
  const countBy = (module: Module) => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      if (note.module !== module) continue;
      for (const type of note.errorTypes) {
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  };

  return {
    daysPracticed: days.size,
    daysElapsed: daysIntoWeek(toDateKeyInSeoul(), currentWeek),
    problemsSolved,
    tracks,
    recent: attempts.slice(0, 8),
    dictationWeakness: countBy('dictation'),
    spellingWeakness: countBy('spelling'),
    activeNoteCount: notes.filter((n) => n.streak < 2).length,
    graduatedCount: notes.filter((n) => n.streak >= 2).length,
  };
}
