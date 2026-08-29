import type { SupabaseClient } from '@supabase/supabase-js';
import type { ErrorType } from './grading';
import { limitsFor, planOf } from './plan';
import type { WrongNote } from './review';
import { needsTwin, pickSpellingTwin } from './twin';
import { makeTwin } from './twin-ai';

/**
 * 오답노트에 짝 문제를 채웁니다.
 *
 * **아이를 기다리게 하지 않는 것이 요점입니다.**
 * AI 는 2~5초 걸립니다. 아이가 원본을 맞힌 그 순간에 부르면 그만큼 멈춰 있습니다.
 * 그래서 **틀린 순간에 미리** 만들어 둡니다 — 아이가 오답노트에 돌아오는 것은
 * 빨라야 몇 분 뒤이고, 대개 며칠 뒤입니다.
 * 문장별로 소리를 미리 담아 두는 것과 같은 원리입니다.
 *
 * 두 갈래가 값이 완전히 다릅니다.
 *
 *   맞춤법  문제은행에서 같은 태그 고르기   0원, 즉시, 사람이 쓴 문항 — **언제나 무료**
 *   받아쓰기 AI 가 새 문장 만들기            몇 원, 몇 초 — 요금제로 나눌 수 있는 자리
 *
 * 그래서 요금제 문은 받아쓰기 쪽에만 답니다. 맞춤법 짝을 잠그면
 * 원가 0원짜리를 잠그는 셈이라 나중에 설명하기 부끄러워집니다.
 */

export interface FillResult {
  filled: number;
  tried: number;
}

/** 한 번에 이만큼만 채웁니다. 오답이 스무 개 쌓인 아이가 화면 하나에서 스무 번을 부르면 안 됩니다. */
const MAX_PER_CALL = 3;

export async function fillTwins(
  supabase: SupabaseClient,
  childId: string,
  notes: WrongNote[],
): Promise<FillResult> {
  const 대상 = notes.filter((n) => needsTwin(n)).slice(0, MAX_PER_CALL);
  if (대상.length === 0) return { filled: 0, tried: 0 };

  /*
    같은 아이의 다른 노트에 이미 쓰인 짝은 다시 내지 않습니다.
    맞춤법에서 특히 그렇습니다 — 태그당 문항이 서넛뿐이라
    가려내지 않으면 두 노트가 같은 문제를 짝으로 물고 옵니다.
  */
  const 이미쓴것 = new Set(
    notes.flatMap((n) => [n.refId, ...(n.twinRef ? [n.twinRef] : [])]),
  );

  let filled = 0;

  for (const note of 대상) {
    let twinRef: string | null = null;

    if (note.module === 'spelling') {
      // 태그는 오답을 저장할 때 errorTypes 에 그대로 넣어 두었습니다(SpellingRunner).
      const picked = pickSpellingTwin(note.errorTypes, [...이미쓴것]);
      twinRef = picked?.id ?? null;
    } else if (limitsFor(planOf(null)).twinSentences) {
      twinRef = await makeTwin({
        origin: note.refId,
        wrongInput: note.lastWrongInput,
        errorTypes: note.errorTypes as ErrorType[],
        used: [...이미쓴것].filter((s) => s !== note.refId).slice(0, 10),
      });
    }

    if (twinRef) 이미쓴것.add(twinRef);

    /*
      실패해도 시도 횟수는 올립니다.

      twin_ref 가 비어 있는 것만으로는 「아직 안 만들었음」과 「만들려다 실패했음」을
      가릴 수 없어, 오답노트를 열 때마다 될 리 없는 호출을 또 던지게 됩니다.
    */
    const { error } = await supabase
      .from('wrong_notes')
      .update({ twin_ref: twinRef, twin_tries: note.twinTries + 1 })
      .eq('child_id', childId)
      .eq('module', note.module)
      .eq('ref_id', note.refId);

    if (error) console.error('[twin] 짝을 저장하지 못했습니다', error);
    else if (twinRef) filled += 1;
  }

  return { filled, tried: 대상.length };
}
