import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { ERROR_LABEL, type ErrorType } from '@/lib/grading';
import { getReport } from '@/lib/data';
import { listChildren, readActiveProfile } from '@/lib/profile-server';

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
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          최근 4주 기록이에요
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
      <div className="surface mb-6 grid grid-cols-3 divide-x" style={{ borderColor: 'var(--rule)' }}>
        {[
          { label: '연습한 날', value: report.daysPracticed === 0 ? '—' : `${report.daysPracticed}일` },
          { label: '푼 문제', value: report.problemsSolved === 0 ? '—' : `${report.problemsSolved}개` },
          { label: '평균 점수', value: report.averageScore === null ? '—' : `${report.averageScore}점` },
        ].map((stat) => (
          <div key={stat.label} className="px-2 py-4 text-center">
            <div className="display text-xl font-bold">{stat.value}</div>
            <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-title mb-2">주마다 평균</h2>
      <ul className="surface mb-6 flex flex-col gap-3 p-4">
        {report.weeklyAverages.map((week) => (
          <li key={week.label} className="flex items-center gap-3 text-sm">
            <span className="w-14 shrink-0" style={{ color: 'var(--ink-soft)' }}>
              {week.label}
            </span>
            <Bar value={week.average ?? 0} total={100} />
            <span className="w-12 text-right text-xs tabular-nums" style={{ color: 'var(--ink-faint)' }}>
              {week.average === null ? '기록 없음' : `${week.average}점`}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="section-title mb-2">받아쓰기 — 어디서 자주 틀릴까요</h2>
      {dictationTotal === 0 ? (
        <p className="surface mb-6 p-5 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          아직 분석할 기록이 모이지 않았어요.
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

      <h2 className="section-title mb-2">맞춤법 — 헷갈리는 말</h2>
      {spellingTotal === 0 ? (
        <p className="surface mb-6 p-5 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          아직 분석할 기록이 모이지 않았어요.
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
