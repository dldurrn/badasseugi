'use client';

import { useState } from 'react';
import { InlineNotePractice } from './InlineNotePractice';
import type { Settings } from '@/lib/settings';
import { NoteDeleteButton } from './NoteDeleteButton';
import { Stars } from './Stars';
import type { SpellingQuestion } from '@/data/spelling-bank';
import type { Module } from '@/lib/types';

/**
 * 오답노트 한 줄.
 *
 * "지금 풀기"를 누르면 이 자리에서 바로 펼쳐집니다.
 * 세션 화면으로 나갔다 돌아오는 왕복을 없애기 위해서입니다(절대 원칙 10).
 * 정리(지우기)는 어른의 일이라 보호자 화면에서만 보입니다.
 */
export function NoteItem({
  note,
  question,
  childId,
  settings,
}: {
  note: {
    id: string;
    module: Module;
    refId: string;
    content: string;
    streak: number;
    wrongCount: number;
  };
  /** 맞춤법 오답이면 문제은행에서 찾은 문제 */
  question?: SpellingQuestion;
  /** 자녀 모드일 때만 값이 있습니다. 없으면 풀기 버튼을 감춥니다. */
  childId: string | null;
  settings: Settings;
}) {
  const [open, setOpen] = useState(false);

  // 맞춤법인데 문제은행에서 사라진 항목은 풀 수 없습니다.
  const canPractice = Boolean(childId) && (note.module === 'dictation' || Boolean(question));

  // 받아쓰기를 푸는 동안에는 정답 문장을 가립니다.
  // 목록에 문장이 그대로 적혀 있으면 듣지 않고 베껴 쓸 수 있어 문제가 성립하지 않습니다.
  // 맞춤법은 문제 자체를 봐야 풀 수 있으므로 가리지 않습니다.
  const hideAnswer = open && note.module === 'dictation';

  return (
    /*
      받아쓰기를 푸는 동안만 카드를 넓힙니다.

      원고지는 15칸이라 **카드 폭이 곧 글자 크기**입니다.
      좁은 카드 안에서는 칸이 18px까지 줄고, 글자는 하한(14px)에 걸려
      칸의 77%를 채웁니다 — 작은 데다 칸에 끼기까지 합니다.
      같은 「한 문장 받아쓰기」인데 세션 화면과 딴판이 됩니다.

      넓히는 것은 격자가 아니라 카드입니다(.page--write와 같은 이치) —
      격자만 밀어내면 듣기 버튼과 확인 버튼이 그대로 있어 기둥이 둘로 보입니다.
    */
    <li className={open && note.module === 'dictation' ? 'surface p-4 note--writing' : 'surface p-4'}>
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex-1 text-base"
          style={hideAnswer ? { color: 'var(--ink-faint)' } : undefined}
        >
          {hideAnswer ? '들려주는 문장을 받아쓰세요' : note.content}
        </span>
        <Stars streak={note.streak} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1 text-xs" style={{ color: 'var(--ink-faint)' }}>
          {note.module === 'dictation' ? '받아쓰기' : '맞춤법'} · {note.wrongCount}번 틀림
        </span>

        {canPractice && !open && (
          <button
            onClick={() => setOpen(true)}
            className="btn btn-secondary shrink-0"
            style={{ padding: '7px 12px', fontSize: 13 }}
          >
            지금 풀기
          </button>
        )}

        {!childId && <NoteDeleteButton id={note.id} content={note.content} />}
      </div>

      {open && childId && (
        <InlineNotePractice
          childId={childId}
          module={note.module}
          refId={note.refId}
          content={note.content}
          question={question}
          settings={settings}
          onClose={() => setOpen(false)}
        />
      )}
    </li>
  );
}
