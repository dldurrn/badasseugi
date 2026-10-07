'use client';

import { useState } from 'react';
import { DictationSetCard } from '@/components/DictationSetCard';
import type { ChildProfile } from '@/lib/types';
import { hiddenLabel, visibleCount, withHidden } from '@/lib/visibility';

interface ParentSet {
  id: string;
  name: string;
  detail: string;
  hasChoice: boolean;
  hiddenFor: string[];
}

/**
 * 보호자 화면의 「직접 넣은 문제」 목록.
 *
 * 평소에는 예전과 똑같이 카드가 나옵니다. 「아이별로 보이기」를 누르면
 * **같은 목록이 체크 모드로** 바뀝니다 — 새 화면으로 보내지 않습니다.
 * 어느 카드가 어느 문제인지 다시 찾을 필요가 없고, 화면 왕복이 하나 줄어듭니다.
 *
 * 체크를 바꾸면 **바로 저장**합니다(기다리지 않고 먼저 그립니다).
 * 실패하면 되돌리고 알립니다 — 눌렀는데 아무 말 없이 안 바뀌는 것보다 낫습니다.
 *
 * 아이가 한 명뿐이면 버튼을 그리지 않습니다. 눌러도 의미 없는 버튼을 만들지 않습니다.
 */
export function ParentSetList({
  sets,
  kids,
}: {
  sets: ParentSet[];
  kids: ChildProfile[];
}) {
  const [hidden, setHidden] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(sets.map((s) => [s.id, s.hiddenFor])),
  );
  const [editing, setEditing] = useState(false);
  const [kidId, setKidId] = useState(kids[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const canManage = kids.length >= 2;
  const rows = sets.map((s) => ({ ...s, hiddenFor: hidden[s.id] ?? [] }));
  const shown = visibleCount(rows, kidId);

  /** 한 번에 하나 이상. 먼저 화면을 바꾸고, 저장이 실패하면 그 부분만 되돌립니다. */
  async function apply(setIds: string[], hide: boolean) {
    if (setIds.length === 0) return;
    setError(null);
    const before = hidden;
    setHidden((prev) => {
      const next = { ...prev };
      for (const id of setIds) next[id] = withHidden(next[id] ?? [], kidId, hide);
      return next;
    });

    let ok = false;
    try {
      const res = await fetch('/api/sets/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: kidId, setIds, hidden: hide }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      setHidden(before);
      setError('저장하지 못했어요. 인터넷을 확인하고 다시 눌러 주세요.');
    }
  }

  const kid = kids.find((k) => k.id === kidId);

  return (
    <div>
      {canManage && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setEditing((v) => !v);
              setError(null);
            }}
            aria-pressed={editing}
          >
            {editing ? '완료' : '아이별로 보이기'}
          </button>
        </div>
      )}

      {editing && (
        <div className="surface-sunk mb-3 p-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="누구 화면에 보일지 고르기">
            {kids.map((k) => (
              <button
                key={k.id}
                type="button"
                className={`btn ${k.id === kidId ? 'btn-primary' : 'btn-secondary'}`}
                aria-pressed={k.id === kidId}
                onClick={() => setKidId(k.id)}
              >
                <span aria-hidden="true">{k.avatar}</span> {k.nickname}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-sm" style={{ color: 'var(--ink-soft)' }} aria-live="polite">
              {kid?.nickname}에게 {shown} / {sets.length}개 보여요
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  apply(
                    rows.filter((r) => r.hiddenFor.includes(kidId)).map((r) => r.id),
                    false,
                  )
                }
              >
                전체 선택
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  apply(
                    rows.filter((r) => !r.hiddenFor.includes(kidId)).map((r) => r.id),
                    true,
                  )
                }
              >
                전체 해제
              </button>
            </span>
          </div>

          <p className="mt-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
            체크를 바꾸면 바로 저장돼요. 해제한 문제는 {kid?.nickname} 화면에서만 안 보이고,
            푼 기록은 그대로 남아요.
          </p>
          {shown === 0 && (
            <p className="mt-2 text-sm font-bold" style={{ color: 'var(--pen)' }}>
              지금 {kid?.nickname}에게 보이는 문제가 없어요.
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm font-bold" role="alert" style={{ color: 'var(--pen)' }}>
              {error}
            </p>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((set) => {
          if (!editing) {
            const note = canManage ? hiddenLabel(set.hiddenFor, kids) : null;
            return (
              <li key={set.id}>
                <DictationSetCard
                  href={`/dictation/${set.id}`}
                  name={set.name}
                  detail={note ? `${set.detail} · ${note}` : set.detail}
                  isChild={false}
                  hasChoice={set.hasChoice}
                />
              </li>
            );
          }

          const on = !set.hiddenFor.includes(kidId);
          return (
            <li key={set.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => apply([set.id], on)}
                className="surface flex w-full items-center gap-3 p-4 text-left"
                style={{ opacity: on ? 1 : 0.5 }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-md border-2 text-sm font-bold"
                  style={{
                    borderColor: 'var(--grid)',
                    background: on ? 'var(--grid)' : 'transparent',
                    color: '#fff',
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                <span className="min-w-0">
                  <span className="display block text-base font-bold">{set.name}</span>
                  <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
                    {set.detail}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
