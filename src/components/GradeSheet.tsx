'use client';

import { toGradeCells, toGradeRows, type GradeCell } from '@/lib/grade-cells';
import {
  ERROR_HINT,
  ERROR_LABEL,
  type Column,
  type GradeResult,
} from '@/lib/grading';
import { spellOut } from '@/lib/hangul';
import { WONGOJI_COLS, padToGrid, toCells } from '@/lib/wongoji';

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

/* ------------------------------------------------------------------ */
/* 원고지 채점표                                                        */
/*                                                                     */
/* 아이가 원고지에 썼으면 채점도 원고지로 봐야 합니다.                    */
/* 낱낱의 칸을 띄엄띄엄 늘어놓으면 **몇째 칸에서 틀렸는지** 셀 수가 없고,  */
/* 쉼표 뒤처럼 칸 세는 법이 다른 자리에서는 칸 수까지 어긋납니다.         */
/* ------------------------------------------------------------------ */

/** 칸 안에 들어가는 빨간펜 표식. 칸 크기를 따라 줄고 늘어야 합니다. */
function CellMark({ kind }: { kind: 'vee' | 'cross' }) {
  return (
    <span className="wg-gc-mark">
      <PenMark kind={kind} />
    </span>
  );
}

/** 윗줄 — 아이가 쓴 것 */
function MineCell({ cell }: { cell: GradeCell }) {
  switch (cell.kind) {
    case 'same':
      return <span className="wg-cell">{cell.input}</span>;
    case 'diff':
    case 'extra':
      return <span className="wg-cell wg-gc--bad">{cell.input}</span>;
    case 'missing':
      // 정답에는 있는데 아이가 아무것도 안 쓴 칸
      return <span className="wg-cell wg-gc--void">·</span>;
    case 'needSpace':
      // 정답은 이 칸을 비웠는데 아이는 안 비웠습니다
      return (
        <span className="wg-cell wg-gc--bad">
          <CellMark kind="vee" />
        </span>
      );
    case 'extraSpace':
      // 아이가 비운 칸인데 정답에는 그 칸이 없습니다
      return (
        <span className="wg-cell wg-gc--bad">
          <CellMark kind="cross" />
        </span>
      );
    case 'blank':
      return <span className="wg-cell" />;
    case 'pad':
      return <span className="wg-cell wg-gc--pad" />;
  }
}

/** 아랫줄 — 정답 */
function AnswerCell({ cell }: { cell: GradeCell }) {
  switch (cell.kind) {
    case 'same':
      return <span className="wg-cell wg-gc--ans">{cell.answer}</span>;
    case 'diff':
      return (
        <span
          className={`wg-cell wg-gc--fix${cell.error === 'batchim' ? ' wg-gc--batchim' : ''}`}
        >
          {cell.answer}
        </span>
      );
    case 'missing':
      return <span className="wg-cell wg-gc--fix">{cell.answer}</span>;
    case 'needSpace':
      // 비어 있지만 **비우는 것이 정답**이라 짚어 줍니다
      return <span className="wg-cell wg-gc--fix" />;
    case 'blank':
      return <span className="wg-cell wg-gc--ans" />;
    case 'extra':
    case 'extraSpace':
      // 정답에는 없는 칸
      return <span className="wg-cell wg-gc--void">·</span>;
    case 'pad':
      return <span className="wg-cell wg-gc--pad" />;
  }
}

/**
 * 한 줄(15칸)이 곧 격자 하나입니다.
 *
 * 전체를 한 격자에 이어 붙이면 「내가 쓴 것」이 다 지나간 다음에야
 * 「정답」이 나와서, 위아래로 견주는 뜻이 사라집니다.
 * 줄마다 위/아래 두 줄을 붙여 놓아야 같은 세로줄에서 눈이 오르내립니다.
 */
function GradePaper({ result }: { result: GradeResult }) {
  const rows = toGradeRows(toGradeCells(result.columns));

  return (
    <div className="wg-grade">
      {/* 칸을 하나하나 읽어 주면 오히려 알아듣기 어렵습니다. 문장 두 줄로 대신합니다. */}
      <p className="sr-only">
        내가 쓴 것: {result.input}. 정답: {result.answer}.
      </p>
      {rows.map((row, r) => (
        <div
          key={r}
          className="wg wg--fill"
          style={{ ['--wg-cols' as string]: WONGOJI_COLS }}
          aria-hidden="true"
        >
          {row.map((cell, i) => (
            <MineCell key={`m${i}`} cell={cell} />
          ))}
          {row.map((cell, i) => (
            <AnswerCell key={`a${i}`} cell={cell} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 맞았을 때 — 정답만 원고지에 얹어 보여 줍니다 */
function AnswerPaper({ answer }: { answer: string }) {
  const cells = toCells(answer);
  // 문장이 끝난 뒤의 칸은 그냥 남은 종이입니다.
  // 문장 안의 띄어쓰기 칸과 갈라 칠해야 어디까지가 답인지 보입니다.
  const written = cells.length;

  return (
    <div className="wg-grade">
      <p className="sr-only">정답: {answer}</p>
      <div
        className="wg wg--fill"
        style={{ ['--wg-cols' as string]: WONGOJI_COLS }}
        aria-hidden="true"
      >
        {padToGrid(cells, 1).map((ch, i) => (
          <span key={i} className={`wg-cell${i < written ? ' wg-gc--ans' : ' wg-gc--pad'}`}>
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 그냥 쓰기 채점표                                                     */
/*                                                                     */
/* **세로 짝은 그대로, 격자만 벗깁니다.**                                */
/*                                                                     */
/* 한때 원고지 채점표로 하나로 합쳤던 적이 있습니다. 합친 까닭은          */
/* 「몇째 칸에서 틀렸는지 세려면 칸이 이어져 있어야 한다」였는데,          */
/* 그건 **원고지에 쓴 아이 얘기**였습니다. 그냥 쓰기로 쓴 아이에게는       */
/* 셀 칸이 애초에 없어서, 없는 격자를 채점에서 처음 만나게 됩니다.        */
/*                                                                     */
/* 대신 못 버리는 것이 있습니다 — 「내가 쓴 것」과 「정답」을 **같은        */
/* 세로줄**에 놓는 것(절대 원칙 6). 두 줄을 따로 흘려 쓰면 글자를          */
/* 빠뜨렸을 때 길이가 달라져 어긋납니다. 그래서 짝은 그대로 두고           */
/* 격자·남은 종이만 걷어냅니다.                                          */
/*                                                                     */
/* 두 벌이 되지만 **데이터는 한 벌**입니다. 여기는 `result.columns`을     */
/* 그대로 쓰고, 원고지 쪽만 `toGradeCells`로 칸에 앉힙니다.              */
/* 예전에 짐이 됐던 것은 열을 칸으로 옮기는 셈이 두 벌이었기 때문입니다.   */
/*                                                                     */
/* 덤으로 쉼표 자리가 바로잡힙니다 — 「쉼표 뒤는 칸을 안 비운다」는        */
/* 원고지 규칙이라, 그냥 쓰기 채점표는 그 규칙을 아예 거치지 않습니다.     */
/* ------------------------------------------------------------------ */

/** 한 열 = 위(내가 쓴 것) / 아래(정답) 한 짝. 칸 테두리 없이 글자만 세웁니다. */
function PlainColumn({ column }: { column: Column }) {
  switch (column.kind) {
    case 'same':
      return (
        <span className="gl-col">
          <span className="gl-mine">{column.input}</span>
          <span className="gl-ans">{column.answer}</span>
        </span>
      );

    case 'diff':
      return (
        <span className="gl-col gl-col--bad">
          <span className="gl-mine gl-mine--wrong">{column.input}</span>
          <span className="gl-ans gl-ans--fix">{column.answer}</span>
        </span>
      );

    case 'missing':
      return (
        <span className="gl-col gl-col--bad">
          <span className="gl-mine gl-mine--void" aria-label="쓰지 않음">
            ·
          </span>
          <span className="gl-ans gl-ans--fix">{column.answer}</span>
        </span>
      );

    case 'extra':
      return (
        <span className="gl-col gl-col--bad">
          <span className="gl-mine gl-mine--wrong">{column.input}</span>
          <span className="gl-ans gl-ans--void" aria-label="정답에 없음">
            ·
          </span>
        </span>
      );

    /*
      띄어쓰기는 글자가 없는 오류라 표식으로 짚습니다.
      원고지에서는 빈 칸 자체가 드러내 주지만, 격자가 없으면 보이지 않습니다.
    */
    case 'needSpace':
      return (
        <span className="gl-col gl-col--bad">
          {/* 표식도 글자와 **같은 상자**에 담습니다 — 안 그러면 윗줄이 줄로 안 읽힙니다 */}
          <span className="gl-mine gl-mine--mark">
            <PenMark kind="vee" />
          </span>
          <span className="gl-ans gl-ans--space" />
        </span>
      );

    case 'extraSpace':
      return (
        <span className="gl-col gl-col--bad">
          <span className="gl-mine gl-mine--mark">
            <PenMark kind="cross" />
          </span>
          <span className="gl-ans gl-ans--void">·</span>
        </span>
      );
  }
}

/**
 * 그냥 쓰기로 쓴 답의 채점표.
 *
 * 문장이 끝나는 데서 끝납니다 — 남은 종이를 채우지 않습니다.
 * 줄은 글처럼 자연스럽게 넘어갑니다.
 */
function GradeLine({ result }: { result: GradeResult }) {
  return (
    <div className="gl-wrap">
      {/* 칸을 하나하나 읽어 주면 오히려 알아듣기 어렵습니다. 문장 두 줄로 대신합니다. */}
      <p className="sr-only">
        내가 쓴 것: {result.input}. 정답: {result.answer}.
      </p>
      <div className="gl" aria-hidden="true">
        {result.columns.map((c, i) => (
          <PlainColumn key={i} column={c} />
        ))}
      </div>
    </div>
  );
}

/** 맞았을 때 — 그냥 쓰기에서는 문장 그대로 보여 줍니다 */
function AnswerLine({ answer }: { answer: string }) {
  return (
    <p className="gl-correct">
      {answer}
    </p>
  );
}

export function GradeSheet({
  result,
  note,
  writeMode = 'wongoji',
}: {
  result: GradeResult;
  /** 별 획득 안내 등 상황별 한 줄 안내 */
  note?: string | null;
  /**
   * 아이가 어떻게 썼나. **쓴 방식대로 견주어 줍니다.**
   *
   * 원고지에 썼으면 칸으로, 그냥 썼으면 글로.
   * 없는 격자를 채점에서 처음 만나면 무엇을 보라는 건지 한 박자 늦게 알아듣습니다.
   */
  writeMode?: 'wongoji' | 'plain';
}) {
  const 그냥쓰기 = writeMode === 'plain';
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
        {그냥쓰기 ? <AnswerLine answer={result.answer} /> : <AnswerPaper answer={result.answer} />}
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

      {그냥쓰기 ? <GradeLine result={result} /> : <GradePaper result={result} />}

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
