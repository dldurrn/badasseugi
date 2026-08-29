import { findBuiltinSet, isBuiltinSetId } from '@/data/dictation-bank';
import { createClient } from '@/lib/supabase/server';
import { seoulWeekStart, toDateKeyInSeoul, type WrongNote } from '@/lib/review';
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
}

export async function listSets(childId: string | null): Promise<SetSummary[]> {
  const supabase = await createClient();

  const { data: sets } = await supabase
    .from('sets')
    .select('id, name, created_at, set_items(count)')
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
    // PostgREST의 집계는 [{ count: n }] 형태로 옵니다.
    const nested = row.set_items as unknown as Array<{ count: number }> | null;
    return {
      id: row.id as string,
      name: row.name as string,
      createdAt: row.created_at as string,
      count: nested?.[0]?.count ?? 0,
      best: bestBySet.get(row.id as string) ?? null,
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
  /** 최근 7일 */
  daysPracticed: number;
  problemsSolved: number;
  averageScore: number | null;
  /** 최근 28일 주차별 평균 (오래된 주 → 최근 주) */
  weeklyAverages: Array<{ label: string; average: number | null; count: number }>;
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
  const averageScore =
    thisWeek.length === 0
      ? null
      : Math.round(thisWeek.reduce((sum, a) => sum + a.score, 0) / thisWeek.length);

  const weeklyAverages = [3, 2, 1, 0].map((weeksAgo) => {
    const monday = seoulWeekStart(new Date(Date.now() - weeksAgo * 7 * DAY));
    const bucket = byWeek.get(monday) ?? [];
    return {
      label: weeksAgo === 0 ? '이번 주' : weeksAgo === 1 ? '지난주' : `${weeksAgo}주 전`,
      average:
        bucket.length === 0
          ? null
          : Math.round(bucket.reduce((sum, a) => sum + a.score, 0) / bucket.length),
      count: bucket.length,
    };
  });

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
    problemsSolved,
    averageScore,
    weeklyAverages,
    recent: attempts.slice(0, 8),
    dictationWeakness: countBy('dictation'),
    spellingWeakness: countBy('spelling'),
    activeNoteCount: notes.filter((n) => n.streak < 2).length,
    graduatedCount: notes.filter((n) => n.streak >= 2).length,
  };
}
