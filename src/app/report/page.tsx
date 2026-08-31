import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { ERROR_LABEL, type ErrorType } from '@/lib/grading';
import { getReport } from '@/lib/data';
import { listChildren, readActiveProfile } from '@/lib/profile-server';

export const metadata = { title: '리포트 · 받아쓰기 공책' };

/**
 * 리포트 — 보호자 화면.
 *
 * 점수보다 "무엇이 나아지고 있는지"를 앞에 둡니다.
 * 그래서 총점 대신 주차별 평균과 오답 유형을 먼저 보여 줍니다.
 * 아이를 다그칠 근거가 아니라, 다음에 무엇을 함께 볼지 고르는 자료입니다.
 */

const KNOWN_ERROR_TYPES: ErrorType[] = [
  'batchim',
  'vowel',
  'consonant',
  'spacing',
  'punct',
  'letter',
];

function labelFor(type: string): string {
  return KNOWN_ERROR_TYPES.includes(type as ErrorType)
    ? ERROR_LABEL[type as ErrorType]
    : type;
}

function Bar({ value, total }: { value: number; total: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--paper-sunk)' }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${total === 0 ? 0 : (value / total) * 100}%`, background: 'var(--grid)' }}
      />
    </div>
  );
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { child: requested } = await searchParams;
  const { view, child: active } = await readActiveProfile();

  if (view !== 'parent') {
    return (
      <main className="page">
        <header className="mb-5 pt-4">
          <h1 className="display text-2xl font-bold">리포트</h1>
        </header>
        <EmptyState
          title="보호자 화면에서 볼 수 있어요"
          description="아이가 무엇을 어려워하는지 정리한 화면이라 어른이 보는 자리예요."
          action={
            <Link href="/children" className="btn btn-secondary">
              프로필 바꾸기
            </Link>
          }
        />
      </main>
    );
  }

  const children = await listChildren();
  const selected =
    children.find((c) => c.id === requested) ??
    children.find((c) => c.id === active?.id) ??
    children[0];

  if (!selected) {
    return (
      <main className="page">
        <header className="mb-5 pt-4">
          <h1 className="display text-2xl font-bold">리포트</h1>
        </header>
        <EmptyState
          title="아직 프로필이 없어요"
          description="아이 프로필을 만들면 그때부터 기록이 쌓여요."
          action={
            <Link href="/children/new" className="btn btn-primary">
              프로필 만들기
            </Link>
          }
        />
      </main>
    );
  }

  const report = await getReport(selected.id);
  const dictationTotal = report.dictationWeakness.reduce((sum, [, n]) => sum + n, 0);
  const spellingTotal = report.spellingWeakness.reduce((sum, [, n]) => sum + n, 0);

  return (
    <main className="page">
      <header className="mb-4 pt-4">
        <h1 className="display text-2xl font-bold">리포트</h1>
        {/*
          예전에는 여기 「최근 4주 기록이에요」라고 적혀 있었습니다.
          그런데 오답 유형은 전체 기간이라 사실이 아니었습니다.
          범위는 구역마다 달라서, 머리말에서 단정하지 않고 각 구역이 스스로 밝힙니다.
        */}
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {selected.nickname} 님의 기록이에요
        </p>
      </header>

      {children.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {children.map((c) => {
            const on = c.id === selected.id;
            return (
              <Link
                key={c.id}
                href={`/report?child=${c.id}`}
                className="rounded-full px-3 py-1.5 text-sm"
                style={{
                  background: on ? 'var(--grid)' : 'var(--card)',
                  color: on ? '#fff' : 'var(--ink-soft)',
                  border: `1px solid ${on ? 'var(--grid)' : 'var(--rule-strong)'}`,
                  fontWeight: on ? 700 : 500,
                }}
              >
                <span aria-hidden="true">{c.avatar} </span>
                {c.nickname}
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="section-title mb-2">이번 주</h2>
      {/*
        평균 점수를 여기서 뺐습니다. 아래 갈래 표의 「이번 주」 칸과 **완전히 같은 셈**이라
        같은 숫자가 두 번 나오고 있었습니다. 그리고 뭉갠 평균은 견줄 수 없는 것을 견줍니다.
      */}
      <div className="surface mb-6 grid grid-cols-2 divide-x" style={{ borderColor: 'var(--rule)' }}>
        {[
          {
            label: `이번 주 ${report.daysElapsed}일 중`,
            value: report.daysPracticed === 0 ? '—' : `${report.daysPracticed}일`,
          },
          { label: '푼 문제', value: report.problemsSolved === 0 ? '—' : `${report.problemsSolved}개` },
        ].map((stat) => (
          <div key={stat.label} className="px-2 py-4 text-center">
            <div className="display text-xl font-bold">{stat.value}</div>
            <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/*
        갈래(과목 × 방식)로 나눠 보여 줍니다.

        예전에는 전부 한 평균이었습니다. 그러면 받아쓰기 20단계 시험과
        맞춤법 1단계 연습이 같은 숫자에 들어가서, 「지난주 75 → 이번 주 82」가
        **실력이 는 것인지 쉬운 걸 고른 것인지 구분할 수 없었습니다.**
        한 줄 안에서는 견줄 만한 것끼리만 견줍니다.
      */}
      <h2 className="section-title mb-2">주마다 점수</h2>
      {report.tracks.length === 0 ? (
        <p className="surface mb-6 p-5 text-center text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          아직 기록이 없어요.
          <br />
          아이가 한 세트를 끝까지 마치면 여기에 쌓여요.
        </p>
      ) : (
        <div className="surface mb-2 overflow-x-auto">
          <table className="report-weeks">
            <thead>
              <tr>
                <th scope="col" className="report-weeks__name"></th>
                {report.tracks[0].weeks.map((w) => (
                  <th key={w.label} scope="col">
                    {w.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.tracks.map((track) => (
                <tr key={track.key}>
                  <th scope="row" className="report-weeks__name">
                    {track.label}
                  </th>
                  {track.weeks.map((w) => (
                    <td key={w.label}>
                      {/*
                        기록이 없는 주는 0점이 아니라 「—」입니다.
                        안 한 것과 못 한 것은 부모에게 완전히 다른 이야기입니다.
                      */}
                      {w.average === null ? (
                        <span className="report-weeks__none">—</span>
                      ) : (
                        <>
                          <b>{w.average}</b>
                          <span className="report-weeks__n">{w.count}회</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mb-6 px-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
        최근 4주 · 세션 점수의 평균이에요. 단계 난이도는 아직 가리지 않아요.
      </p>

      {/*
        이 막대는 「몇 번 틀렸나」가 아니라 **그 유형이 든 오답노트가 몇 개인가**입니다.
        같은 문장을 열 번 틀려도 1이고, 졸업한 노트도 그대로 셉니다.
        셈을 바꾸려면 오답 이력을 따로 쌓아야 하므로, 지금은 **뜻을 바로 적습니다.**
      */}
      <h2 className="section-title mb-2">받아쓰기 — 어떤 오답이 남아 있나요</h2>
      {dictationTotal === 0 ? (
        <p className="surface mb-6 p-5 text-center text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          아직 분석할 기록이 모이지 않았어요.
          <br />
          아이가 받아쓰기를 한 번 마치면 어디서 자주 틀리는지 여기에 모여요.
        </p>
      ) : (
        <ul className="surface mb-6 flex flex-col gap-3 p-4">
          {report.dictationWeakness.map(([type, count]) => (
            <li key={type} className="flex items-center gap-3">
              <span className={`tag tag--${type}`} style={{ minWidth: 64 }}>
                {labelFor(type)}
              </span>
              <Bar value={count} total={dictationTotal} />
              <span className="w-8 text-right text-xs tabular-nums" style={{ color: 'var(--ink-faint)' }}>
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="-mt-4 mb-6 px-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
        오답노트에 <b>남아 있는 문제 수</b>예요. 같은 문제를 여러 번 틀려도 하나로 세고,
        졸업한 것도 들어 있어요.
      </p>

      <h2 className="section-title mb-2">맞춤법 — 어떤 오답이 남아 있나요</h2>
      {spellingTotal === 0 ? (
        <p className="surface mb-6 p-5 text-center text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          아직 분석할 기록이 모이지 않았어요.
          <br />
          아이가 맞춤법을 한 번 마치면 헷갈리는 말이 여기에 모여요.
        </p>
      ) : (
        <ul className="surface mb-6 flex flex-col gap-3 p-4">
          {report.spellingWeakness.map(([tag, count]) => (
            <li key={tag} className="flex items-center gap-3">
              <span className="tag tag--letter" style={{ minWidth: 64 }}>
                {tag}
              </span>
              <Bar value={count} total={spellingTotal} />
              <span className="w-8 text-right text-xs tabular-nums" style={{ color: 'var(--ink-faint)' }}>
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="-mt-4 mb-6 px-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
        오답노트에 <b>남아 있는 문제 수</b>예요. 같은 문제를 여러 번 틀려도 하나로 세고,
        졸업한 것도 들어 있어요.
      </p>

      <h2 className="section-title mb-2">오답노트</h2>
      <div className="surface mb-6 flex items-center gap-4 p-4 text-sm">
        <span className="flex-1">
          모으는 중 <b>{report.activeNoteCount}개</b> · 졸업 <b>{report.graduatedCount}개</b>
        </span>
        <Link href="/notes" className="btn btn-quiet">
          보기
        </Link>
      </div>

      <h2 className="section-title mb-2">최근 기록</h2>
      {report.recent.length === 0 ? (
        <p className="surface p-5 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          아직 푼 기록이 없어요. 아이 화면에서 한 세트를 풀어 보세요.
        </p>
      ) : (
        <ul className="surface flex flex-col divide-y p-0" style={{ borderColor: 'var(--rule)' }}>
          {report.recent.map((attempt) => (
            <li key={attempt.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1">
                {attempt.module === 'dictation' ? '받아쓰기' : '맞춤법'}
                <span style={{ color: 'var(--ink-faint)' }}>
                  {' '}
                  · {attempt.mode === 'exam' ? '시험' : '연습'}
                </span>
              </span>
              <span className="tabular-nums" style={{ color: 'var(--ink-soft)' }}>
                {attempt.correctCount}/{attempt.totalCount}
              </span>
              <span className="w-12 text-right font-bold tabular-nums">{attempt.score}점</span>
              <span className="w-12 text-right text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                {new Date(attempt.createdAt).toLocaleDateString('ko-KR', {
                  month: 'numeric',
                  day: 'numeric',
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
