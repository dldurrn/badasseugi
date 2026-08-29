import { NextResponse } from 'next/server';
import { badRequest, readJson, requireUser } from '@/lib/api';
import { fillTwins } from '@/lib/twin-server';
import { isBuiltinSetId } from '@/data/dictation-bank';
import { scoreOf } from '@/lib/grading';
import {
  applySessionOutcomes,
  toDateKeyInSeoul,
  trophyFor,
  type ItemOutcome,
  type WrongNote,
} from '@/lib/review';
import { MAX_OUTCOMES, type CompleteSessionRequest, type CompleteSessionResponse } from '@/lib/session';

/**
 * 세션을 끝까지 마쳤을 때 한 번만 부르는 저장 라우트.
 *
 * 여기서 세 가지가 한꺼번에 일어납니다.
 *   1. 풀이 기록(attempts)
 *   2. 오답노트 갱신(wrong_notes) — 별·졸업 판정
 *   3. 보상(trophies) — 시험 모드만
 *
 * 점수는 화면이 보낸 값을 쓰지 않고 여기서 다시 계산합니다.
 * 트랜잭션은 아니므로 중간에 실패하면 일부만 남을 수 있습니다.
 * 순서를 기록 → 오답노트 → 보상으로 둔 것은,
 * 앞의 것이 남고 뒤가 빠지는 쪽이 그 반대보다 덜 이상하기 때문입니다.
 */

const MODULES: readonly string[] = ['dictation', 'spelling'];
const MODES: readonly string[] = ['practice', 'exam'];
const SPELLING_KINDS: readonly string[] = ['mcq', 'fill', 'find'];

/** 100점 카드에 찍히는 그림. 보관함이 수집물처럼 보이도록 여러 개를 둡니다. */
const GOLD_EMBLEMS = ['🏆', '🌟', '🦕', '🚀', '🐳', '🌈', '🍀', '🎠'];
const SILVER_EMBLEM = '🎖️';

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const body = await readJson<CompleteSessionRequest>(request);
  if (!body) return badRequest('결과를 읽지 못했어요.');

  const { childId, module, mode } = body;

  if (typeof childId !== 'string' || !childId) return badRequest('누가 풀었는지 알 수 없어요.');
  if (!MODULES.includes(module)) return badRequest('알 수 없는 과목이에요.');
  if (!MODES.includes(mode)) return badRequest('알 수 없는 방식이에요.');

  const outcomes = Array.isArray(body.outcomes) ? body.outcomes : [];
  if (outcomes.length === 0) return badRequest('저장할 결과가 없어요.');
  if (outcomes.length > MAX_OUTCOMES) return badRequest('한 번에 저장할 수 있는 양을 넘었어요.');

  const clean: ItemOutcome[] = [];
  for (const o of outcomes) {
    if (typeof o?.refId !== 'string' || !o.refId) return badRequest('결과 형식이 올바르지 않아요.');
    if (typeof o?.content !== 'string' || !o.content) return badRequest('결과 형식이 올바르지 않아요.');
    if (typeof o?.correct !== 'boolean') return badRequest('결과 형식이 올바르지 않아요.');
    clean.push({
      module,
      refId: o.refId.slice(0, 200),
      content: o.content.slice(0, 200),
      correct: o.correct,
      errorTypes: Array.isArray(o.errorTypes)
        ? o.errorTypes.filter((t): t is string => typeof t === 'string').slice(0, 8)
        : [],
      wasTwin: o.wasTwin === true,
      // 아이가 쓴 것. 받아쓰기 한 문장 길이를 넘을 수 없습니다.
      input: typeof o.input === 'string' ? o.input.slice(0, 200) : undefined,
    });
  }

  // 남의 가족 자녀면 RLS에 걸려 조회되지 않습니다.
  const { data: child } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .maybeSingle();
  if (!child) return NextResponse.json({ error: '프로필을 찾지 못했어요.' }, { status: 404 });

  const score = scoreOf(clean);
  const correctCount = clean.filter((o) => o.correct).length;

  /* 1) 풀이 기록 --------------------------------------------------------- */
  // 오답노트에서 한 문제만 그 자리에서 푼 경우는 기록을 남기지 않습니다.
  // 한 문제짜리 0점/100점이 쌓이면 리포트의 평균 점수가 흔들립니다.
  // 남기지 않아도 되는 조건을 서버에서 한 번 더 좁혀 둡니다.
  const logAttempt =
    body.logAttempt !== false || clean.length > 1 || mode === 'exam';

  if (logAttempt) {
    const { error: attemptError } = await supabase.from('attempts').insert({
      child_id: childId,
      module,
      mode,
      set_id: typeof body.setId === 'string' && body.setId ? body.setId : null,
      // 내장 세트는 `sets`에 행이 없어 외래키를 쓸 수 없습니다. 문자열 id로 남깁니다.
      builtin_set_id:
        typeof body.builtinSetId === 'string' && isBuiltinSetId(body.builtinSetId)
          ? body.builtinSetId
          : null,
      spelling_kind:
        module === 'spelling' && typeof body.spellingKind === 'string' &&
        SPELLING_KINDS.includes(body.spellingKind)
          ? body.spellingKind
          : null,
      score,
      correct_count: correctCount,
      total_count: clean.length,
    });

    if (attemptError) {
      console.error('[sessions] 기록 저장 실패', attemptError);
      return NextResponse.json(
        { error: '기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' },
        { status: 500 },
      );
    }
  }

  /* 2) 오답노트 --------------------------------------------------------- */
  // 이 과목의 노트를 통째로 읽습니다. ref_id가 문장 원문이라
  // `in(...)` 으로 거르면 URL이 너무 길어질 수 있습니다.
  const { data: noteRows } = await supabase
    .from('wrong_notes')
    .select(
      'id, module, ref_id, content, error_types, streak, last_correct_date, wrong_count, twin_ref, twin_tries, last_wrong_input',
    )
    .eq('child_id', childId)
    .eq('module', module);

  const existing: WrongNote[] = (noteRows ?? []).map((row) => ({
    id: row.id as string,
    module: row.module as 'dictation' | 'spelling',
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

  const applied = applySessionOutcomes(existing, clean, toDateKeyInSeoul());

  // 이번 세션에서 다룬 문제만 다시 씁니다.
  const touched = new Set(clean.map((o) => o.refId));
  const changed = applied.notes.filter((n) => touched.has(n.refId));

  if (changed.length > 0) {
    const { error: noteError } = await supabase.from('wrong_notes').upsert(
      changed.map((n) => ({
        child_id: childId,
        module: n.module,
        ref_id: n.refId,
        content: n.content,
        error_types: n.errorTypes,
        streak: n.streak,
        last_correct_date: n.lastCorrectDate,
        wrong_count: n.wrongCount,
        twin_ref: n.twinRef,
        twin_tries: n.twinTries,
        last_wrong_input: n.lastWrongInput,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'child_id,module,ref_id' },
    );
    if (noteError) console.error('[sessions] 오답노트 갱신 실패', noteError);

    /*
      짝 문제를 **미리** 만들어 둡니다.

      아이가 원본을 맞힌 그 자리에서 만들면 AI 를 기다리느라 2~5초 멈춥니다.
      지금 만들어 두면 아이가 오답노트로 돌아오는 것은 빨라야 몇 분 뒤입니다.
      문장별로 소리를 미리 담아 두는 것과 같은 원리입니다.

      **기다리지 않습니다.** 짝이 없어도 예전처럼 원본을 두 번 풀어 졸업하므로,
      이것 때문에 세션 저장이 늦어지거나 실패하면 안 됩니다.
      맞춤법은 문제은행에서 고르는 것이라 원가도 0원이고 거의 즉시 끝납니다.
    */
    void fillTwins(supabase, childId, applied.notes).catch((e) =>
      console.error('[sessions] 짝 만들기 실패', e),
    );
  }

  /* 3) 보상 — 시험 모드를 끝까지 마쳤을 때만 --------------------------- */
  const kind = trophyFor(score, mode);
  let trophy: CompleteSessionResponse['trophy'] = null;

  if (kind) {
    const emblem =
      kind === 'gold'
        ? GOLD_EMBLEMS[Math.floor(Math.random() * GOLD_EMBLEMS.length)]
        : SILVER_EMBLEM;
    const label =
      typeof body.sourceName === 'string' && body.sourceName
        ? body.sourceName.slice(0, 60)
        : null;

    const { error: trophyError } = await supabase.from('trophies').insert({
      child_id: childId,
      kind,
      emblem,
      label,
      source_name: label,
      score,
    });

    if (trophyError) console.error('[sessions] 보상 저장 실패', trophyError);
    else trophy = { kind, emblem, label };
  }

  const response: CompleteSessionResponse = {
    score,
    correctCount,
    totalCount: clean.length,
    trophy,
    starsEarned: applied.starsEarned,
    graduated: applied.graduated,
    added: applied.added,
  };

  return NextResponse.json(response);
}
