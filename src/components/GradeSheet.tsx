'use client';

import {
  ERROR_HINT,
  ERROR_LABEL,
  type Column,
  type GradeResult,
} from '@/lib/grading';
import { spellOut } from '@/lib/hangul';

/**
 * 채점 결과 — 이 앱의 시그니처 화면.
 *
 * 핵심은 "내가 쓴 글자"와 "정답 글자"를 같은 세로줄에 놓는 것입니다.
 * 두 줄을 따로 그리면 길이가 달라지면서 어긋나 비교가 어려워집니다.
 * 편집거리로 정렬한 열(column)을 그대로 세로 기둥으로 세워서,
 * 몇 번째 글자가 어떻게 다른지 눈으로 바로 짚이게 합니다.
 *
 * 띄어쓰기는 글자가 없는 오류라 별도 표식이 필요합니다.
 *   ∨ = 여기서 띄어야 해요   ✕ = 여기는 붙여야 해요
 */

/* 빨간펜으로 그은 듯한 교정 표식 */
function PenMark({ kind }: { kind: 'vee' | 'cross' }) {
  const stroke = 'var(--pen)';
  return (
    <svg
      width="22"
      height="26"
      viewBox="0 0 22 26"
      fill="none"
      aria-hidden="true"
      style={{ transform: 'rotate(-3deg)' }}
    >
      {kind === 'vee' ? (
        <path
          d="M4 6 L11 20 L18 5"
          stroke={stroke}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path d="M5 6 L17 20" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M17 6 L5 20" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function MarkColumn({
  kind,
  label,
}: {
  kind: 'vee' | 'cross';
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 26 }}>
      <div style={{ height: 'var(--cell)' }} className="flex items-center justify-center">
        <PenMark kind={kind} />
      </div>
      <span
        className="rounded px-1 text-[10px] font-bold leading-tight"
        style={{ color: 'var(--pen)', background: 'var(--pen-tint)' }}
      >
        {label}
      </span>
    </div>
  );
}

function ColumnPair({ column }: { column: Column }) {
  switch (column.kind) {
    case 'needSpace':
      return <MarkColumn kind="vee" label="띄어요" />;

    case 'extraSpace':
      return <MarkColumn kind="cross" label="붙여요" />;

    case 'same':
      // 띄어쓰기 자리는 좁은 빈 칸으로 표현해 어절이 눈에 들어오게 함
      if (column.answer === ' ') {
        return <div style={{ width: 14 }} aria-hidden="true" />;
      }
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="grid-cell grid-cell--mine">{column.input}</div>
          <div className="grid-cell grid-cell--answer">{column.answer}</div>
        </div>
      );

    case 'diff':
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="grid-cell grid-cell--wrong">{column.input}</div>
          <div
            className={`grid-cell grid-cell--focus${
              column.error === 'batchim' ? ' grid-cell--batchim' : ''
            }`}
          >
            {column.answer}
          </div>
        </div>
      );

    case 'missing':
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="grid-cell grid-cell--void" aria-label="쓰지 않음">
            ·
          </div>
          <div className="grid-cell grid-cell--focus">{column.answer}</div>
        </div>
      );

    case 'extra':
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="grid-cell grid-cell--wrong">{column.input}</div>
          <div className="grid-cell grid-cell--void" aria-label="정답에 없음">
            ·
          </div>
        </div>
      );
  }
}

export function GradeSheet({
  result,
  note,
}: {
  result: GradeResult;
  /** 별 획득 안내 등 상황별 한 줄 안내 */
  note?: string | null;
}) {
  if (result.correct) {
    return (
      <div
        className="surface rise-in p-4"
        style={{ borderColor: 'var(--grid)', borderWidth: 2 }}
      >
        <div
          className="display mb-4 rounded py-3 text-center text-[22px] font-bold"
          style={{ color: 'var(--grid-deep)', background: 'var(--grid-tint)' }}
        >
          맞았어요
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {Array.from(result.answer).map((ch, i) =>
            ch === ' ' ? (
              <div key={i} style={{ width: 14 }} aria-hidden="true" />
            ) : (
              <div key={i} className="grid-cell grid-cell--answer">
                {ch}
              </div>
            ),
          )}
        </div>
        {note && (
          <p
            className="mt-4 rounded-sm px-3 py-2.5 text-center text-sm"
            style={{ background: 'var(--gold-tint)', color: '#6d520c' }}
          >
            {note}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="surface rise-in p-4"
      style={{ borderColor: 'var(--pen)', borderWidth: 2 }}
    >
      <div
        className="display mb-4 rounded py-3 text-center text-[22px] font-bold text-white"
        style={{ background: 'var(--pen)' }}
      >
        다시 볼까요
      </div>

      <div className="mb-2.5 flex justify-center gap-4 text-[11.5px]">
        <span style={{ color: 'var(--ink-soft)' }}>윗줄 · 내가 쓴 것</span>
        <span style={{ color: 'var(--grid)' }}>아랫줄 · 정답</span>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-1.5">
        {result.columns.map((c, i) => (
          <ColumnPair key={i} column={c} />
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {result.errorTypes.map((t) => (
          <div key={t} className="flex items-start gap-2.5 text-sm leading-relaxed">
            <span className={`tag tag--${t} mt-0.5`}>{ERROR_LABEL[t]}</span>
            <span style={{ color: 'var(--ink-soft)' }}>{ERROR_HINT[t]}</span>
          </div>
        ))}
      </div>

      {result.batchimDetails.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {result.batchimDetails.map((b, i) => (
            <div
              key={i}
              className="surface-sunk flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
            >
              <span className="text-xl" style={{ color: 'var(--pen)' }}>
                {b.input}
              </span>
              <span style={{ color: 'var(--ink-faint)' }}>{spellOut(b.input)}</span>
              <span style={{ color: 'var(--ink-faint)' }}>→</span>
              <span className="text-xl font-bold" style={{ color: 'var(--grid)' }}>
                {b.answer}
              </span>
              <span style={{ color: 'var(--grid)' }}>{spellOut(b.answer)}</span>
            </div>
          ))}
        </div>
      )}

      {note && (
        <p
          className="mt-4 rounded-sm px-3 py-2.5 text-center text-sm"
          style={{ background: 'var(--gold-tint)', color: '#6d520c' }}
        >
          {note}
        </p>
      )}
    </div>
  );
}
