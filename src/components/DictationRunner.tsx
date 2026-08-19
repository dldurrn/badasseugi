'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DictationSession, type SessionItem, type SessionOutcome } from './DictationSession';
import { SessionResult } from './SessionResult';
import { initSfx } from '@/lib/sfx';
import { saveSession, starNoteFactory } from '@/lib/save-session';
import type { CompleteSessionResponse } from '@/lib/session';
import type { Mode } from '@/lib/types';

/**
 * 받아쓰기 세션 + 저장 + 결과 화면.
 *
 * `DictationSession`은 화면 흐름만 알고 데이터는 모릅니다.
 * 저장과 결과는 여기서 붙입니다.
 *
 * 저장에 실패해도 푼 결과를 손에 쥐고 있다가 다시 보낼 수 있게 해 둡니다.
 * 끝까지 푼 아이에게 "처음부터 다시"라고 말하지 않기 위해서입니다.
 */
export function DictationRunner({
  childId,
  items,
  mode,
  title,
  setId,
  builtinSetId,
  listHref,
  retryHref,
  starNotes,
}: {
  childId: string;
  items: SessionItem[];
  mode: Mode;
  title: string;
  setId: string | null;
  /** 앱 내장 세트일 때만 값이 있습니다 */
  builtinSetId?: string | null;
  listHref: string;
  retryHref: string;
  /** 오답노트 연습일 때만 넘깁니다 */
  starNotes?: Record<string, { streak: number; lastCorrectDate: string | null }>;
}) {
  const router = useRouter();
  const [result, setResult] = useState<CompleteSessionResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finished = useRef<SessionOutcome[] | null>(null);

  useEffect(() => initSfx(), []);

  const send = async (outcomes: SessionOutcome[]) => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveSession({
        childId,
        module: 'dictation',
        mode,
        setId,
        builtinSetId,
        sourceName: title,
        outcomes,
      });
      setResult(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : '기록을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const complete = (outcomes: SessionOutcome[]) => {
    finished.current = outcomes;
    void send(outcomes);
  };

  if (result) {
    return (
      <SessionResult
        result={result}
        mode={mode}
        title={title}
        wrongItems={(finished.current ?? []).filter((o) => !o.correct).map((o) => o.content)}
        retryHref={retryHref}
        listHref={listHref}
      />
    );
  }

  if (saving || error) {
    return (
      <div className="page">
        <div className="surface mt-12 p-6 text-center">
          {saving ? (
            <p style={{ color: 'var(--ink-soft)' }}>기록을 저장하고 있어요…</p>
          ) : (
            <>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--pen-deep)' }}>
                {error}
                <br />
                푼 내용은 그대로 있어요. 다시 보낼 수 있어요.
              </p>
              <button
                className="btn btn-primary btn-lg mt-4"
                onClick={() => finished.current && send(finished.current)}
              >
                다시 저장하기
              </button>
              {/* 서버가 계속 안 될 때 갇히지 않도록 나가는 길을 둡니다. */}
              <button
                className="btn btn-quiet mt-2 w-full justify-center"
                onClick={() => router.push(listHref)}
              >
                나중에 하기 (이번 기록은 지워져요)
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <DictationSession
      items={items}
      mode={mode}
      title={title}
      starNoteFor={starNotes ? starNoteFactory(starNotes) : undefined}
      onComplete={complete}
      onExit={() => router.push(listHref)}
    />
  );
}
