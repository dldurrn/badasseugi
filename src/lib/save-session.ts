import type { CompleteSessionRequest, CompleteSessionResponse } from '@/lib/session';

/**
 * 세션 결과 보내기.
 *
 * 실패했을 때 결과를 잃지 않는 것이 중요합니다.
 * 끝까지 푼 아이에게 "저장 실패, 처음부터 다시"는 너무 가혹합니다.
 * 그래서 여기서는 던지기만 하고, 화면이 결과를 손에 쥔 채 다시 시도할 수 있게 둡니다.
 */
export async function saveSession(
  payload: CompleteSessionRequest,
): Promise<CompleteSessionResponse> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? '기록을 저장하지 못했어요.');
  }

  return (await response.json()) as CompleteSessionResponse;
}

/**
 * 오답노트 연습에서 별 안내 문구를 만듭니다.
 *
 * 규칙(절대 원칙 5)을 말로 풀어 주는 자리입니다.
 * 별이 몇 개 남았는지 아이가 알아야 한 번 더 할 이유가 생깁니다.
 */
export function starNoteFactory(
  notes: Record<string, { streak: number; lastCorrectDate: string | null }>,
) {
  return (refId: string, correct: boolean): string | null => {
    const note = notes[refId];
    if (!note) return null;

    if (correct) {
      if (note.streak >= 2) return null;
      return note.streak + 1 >= 2
        ? '별 두 개를 다 모았어요! 이 문장은 졸업이에요.'
        : '별을 하나 받았어요. 한 번 더 맞히면 졸업이에요.';
    }

    return note.streak > 0 ? '별이 처음으로 돌아갔어요. 다시 모아 봐요.' : null;
  };
}
