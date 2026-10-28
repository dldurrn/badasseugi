import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  activitySince,
  buildUsage,
  COHORT_OFFSETS,
  CORE_DAYS_28,
  CORE_SESSIONS_28,
  FILTER_LABEL,
  filterFamilies,
  parseFilter,
  parseSort,
  SORT_LABEL,
  sortFamilies,
  STATUS_LABEL,
  type FilterKey,
  type LimitHits,
  type SortKey,
  type AdminActivityRow,
  type AdminFamilyRow,
  type UsageStatus,
} from '@/lib/admin-usage';
import { LIMITS } from '@/lib/plan';
import { readActiveProfile } from '@/lib/profile-server';
import { toDateKeyInSeoul } from '@/lib/review';
import { sourceLabel } from '@/lib/source';
import { createClient } from '@/lib/supabase/server';
import { stepRate, sumTrial, type TrialRow } from '@/lib/trial';

/** n일 전의 서울 날짜 키. 오늘을 하루로 셉니다(7이면 오늘 포함 이레). */
function seoulDaysAgo(n: number): string {
  return toDateKeyInSeoul(new Date(Date.now() - (n - 1) * 86_400_000));
}

export const metadata = {
  title: '운영 현황 · 받아쓰기 공책',
  robots: { index: false, follow: false },
};

/**
 * 운영 현황 — **운영자만** 봅니다. 메뉴 어디에도 걸지 않습니다.
 *
 * 문은 DB 가 지킵니다(0011_admin_usage). 함수가 `admin_users` 에 든 사람인지 스스로 확인하고,
 * 아니면 빈 결과를 돌려줍니다. 여기서는 그 답을 보고 **404 로 시치미를 뗍니다** —
 * 「권한이 없어요」라고 하면 이런 화면이 있다는 것부터 알려 주게 됩니다.
 *
 * 보호자 화면에서만 엽니다(절대 원칙 9). 운영자 기기에서 아이가 열면 남의 집 통계가 보입니다.
 *
 * 세 질의를 **나란히** 보냅니다. 운영자 확인을 먼저 하고 나머지를 부르면 도쿄 왕복이 하나 더 듭니다.
 * 운영자가 아니면 나머지 둘은 어차피 빈 결과라 먼저 보내도 새는 것이 없습니다.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const filter = parseFilter(params.filter);

  const { view } = await readActiveProfile();
  if (view !== 'parent') notFound();

  const supabase = await createClient();
  const [admin, fams, acts, trial] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.rpc('admin_families'),
    supabase.rpc('admin_activity', { since: activitySince() }),
    // 0014 를 안 돌렸으면 이것만 실패합니다. 나머지 통계는 그대로 보여 줍니다.
    supabase.rpc('admin_trial_counts', { since: seoulDaysAgo(28) }),
  ]);
  if (admin.error || admin.data !== true) notFound();

  if (fams.error || acts.error) {
    return (
      <main className="page">
        <h1 className="display pt-4 text-2xl font-bold">운영 현황</h1>
        <p className="surface mt-4 p-5 text-sm" style={{ color: 'var(--ink-soft)' }}>
          통계를 불러오지 못했어요. 마이그레이션 0011 을 돌렸는지 확인하고 새로고침해 보세요.
          <br />
          <code className="text-xs">{fams.error?.message ?? acts.error?.message}</code>
        </p>
      </main>
    );
  }

  const usage = buildUsage(
    (fams.data ?? []) as AdminFamilyRow[],
    (acts.data ?? []) as AdminActivityRow[],
  );
  const { totals } = usage;
  const shown = filterFamilies(sortFamilies([...usage.families], sort), filter);
  const free = LIMITS.free;
  const trialRows = trial.error ? null : ((trial.data ?? []) as TrialRow[]);
  const trialWeek = trialRows ? sumTrial(trialRows, seoulDaysAgo(7)) : null;
  const trialMonth = trialRows ? sumTrial(trialRows, seoulDaysAgo(28)) : null;

  /** 정렬과 거르기는 서로를 지우지 않습니다 — 하나를 바꿔도 다른 하나는 남습니다. */
  const hrefFor = (next: { sort?: SortKey; filter?: FilterKey }) => {
    const q = new URLSearchParams();
    const sk = next.sort ?? sort;
    const fk = next.filter ?? filter;
    if (sk !== 'active') q.set('sort', sk);
    if (fk !== 'all') q.set('filter', fk);
    const qs = q.toString();
    return qs ? `/admin?${qs}` : '/admin';
  };

  const statusCounts = usage.families.reduce<Partial<Record<UsageStatus, number>>>((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {});
  const STATUS_ORDER: UsageStatus[] = ['steady', 'sometimes', 'new', 'fading', 'gone', 'signup-only'];

  const retainedPct =
    totals.retained14.eligible === 0
      ? '—'
      : `${Math.round((totals.retained14.kept / totals.retained14.eligible) * 100)}%`;
  const weekDelta = totals.activeThisWeek - totals.activeLastWeek;

  return (
    <main className="page">
      <header className="mb-4 pt-4">
        <h1 className="display text-2xl font-bold">운영 현황</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {usage.today} 기준 · 운영자 계정은 빼고 셉니다
        </p>
      </header>

      <div className="surface mb-2 grid grid-cols-2 sm:grid-cols-4">
        {[
          { label: '가입한 집', value: `${totals.families}` },
          { label: '이번 주 쓴 집', value: `${totals.activeThisWeek}` },
          {
            label: `지난주 ${totals.activeLastWeek}집`,
            value: weekDelta === 0 ? '±0' : weekDelta > 0 ? `+${weekDelta}` : `${weekDelta}`,
          },
          {
            label: `2주 뒤에도 씀 (${totals.retained14.kept}/${totals.retained14.eligible})`,
            value: retainedPct,
          },
        ].map((stat) => (
          <div key={stat.label} className="px-2 py-4 text-center">
            <div className="display text-xl font-bold tabular-nums">{stat.value}</div>
            <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
      <p className="mb-6 px-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
        「쓴 날」은 세션을 끝까지 마쳤거나, 소리를 들었거나, 사진으로 문제를 넣은 날이에요.
        중간에 나간 세션과 듣고 고르기는 소리를 들은 날로만 잡혀요.
      </p>

      {/*
        유료화 기준을 정하는 재료. **실제로 막는 것이 아닙니다** — 요금제는 꺼져 있습니다.
        「지금 한도를 켰다면 지난 28일에 누가 막혔나」를 대 볼 뿐입니다.
      */}
      <div className="surface mb-2 grid grid-cols-2">
        <div className="px-3 py-4 text-center">
          <div className="display text-xl font-bold tabular-nums">{totals.core}</div>
          <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
            핵심 사용자
          </div>
        </div>
        <div className="px-3 py-4 text-center">
          <div className="display text-xl font-bold tabular-nums">{totals.wouldHit.any}</div>
          <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
            무료 한도에 닿았을 집 (그중 핵심 {totals.wouldHit.core})
          </div>
        </div>
      </div>
      <p className="mb-6 px-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
        핵심 사용자는 최근 28일 중 {CORE_DAYS_28}일 이상 쓰고 세션을 {CORE_SESSIONS_28}회 이상 마친 집이에요.
        한도는 <b>아직 켜지 않았어요</b> — 지금 무료 한도(하루 세션 {free.sessionsPerDay}회 · 아이{' '}
        {free.children}명 · 사진 넣기 안 됨)를 지난 28일에 대 보면 세션 {totals.wouldHit.sessions}집 · 아이 수{' '}
        {totals.wouldHit.children}집 · 사진 {totals.wouldHit.photo}집이 막혔을 거예요.
        리포트 기간과 AI 짝 문제는 쓴 기록이 없어 셀 수 없어요.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => (
          <span key={s} className="admin-status" data-status={s}>
            {STATUS_LABEL[s]} {statusCounts[s]}
          </span>
        ))}
      </div>

      <h2 className="section-title mb-2">
        집마다{' '}
        <span className="text-[12px] font-normal" style={{ color: 'var(--ink-faint)' }}>
          {shown.length}/{usage.families.length}
        </span>
      </h2>
      <nav aria-label="정렬" className="admin-chips mb-1">
        <span className="admin-chips__label">정렬</span>
        {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
          <Link
            key={k}
            href={hrefFor({ sort: k })}
            className="admin-chip"
            aria-current={k === sort ? 'true' : undefined}
            scroll={false}
          >
            {SORT_LABEL[k]}
          </Link>
        ))}
      </nav>
      <nav aria-label="거르기" className="admin-chips mb-3">
        <span className="admin-chips__label">보기</span>
        {(Object.keys(FILTER_LABEL) as FilterKey[]).map((k) => (
          <Link
            key={k}
            href={hrefFor({ filter: k })}
            className="admin-chip"
            aria-current={k === filter ? 'true' : undefined}
            scroll={false}
          >
            {FILTER_LABEL[k]}
          </Link>
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className="surface mb-6 p-5 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          {usage.families.length === 0 ? (
            '아직 가입한 집이 없어요. 링크를 나눈 뒤 다시 와 보세요.'
          ) : (
            <>
              「{FILTER_LABEL[filter]}」에 드는 집이 아직 없어요.{' '}
              <Link href={hrefFor({ filter: 'all' })} className="underline">
                전체 보기
              </Link>
            </>
          )}
        </p>
      ) : (
        <ul className="surface mb-2 flex flex-col divide-y p-0" style={{ borderColor: 'var(--rule)' }}>
          {shown.map((f) => (
            <li key={f.row.family_id}>
              <details className="admin-family">
                <summary className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="admin-status" data-status={f.status}>
                      {STATUS_LABEL[f.status]}
                    </span>
                    {f.core && (
                      <span className="admin-status" data-status="core">
                        핵심
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {f.row.email_masked ?? '(이메일 없음)'}
                      <span style={{ color: 'var(--ink-faint)' }}>
                        {' '}
                        · {f.row.provider === 'kakao' ? '카카오' : '이메일'}
                        {f.row.source && <> · {sourceLabel(f.row.source)}에서</>}
                      </span>
                    </span>
                    <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-faint)' }}>
                      {f.daysSinceActive === null
                        ? '안 씀'
                        : f.daysSinceActive === 0
                          ? '오늘'
                          : `${f.daysSinceActive}일 전`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* 주 8칸 — 원고지 칸처럼. 그 주에 쓴 날이 많을수록 진합니다. */}
                    <div className="admin-weeks" aria-label={`최근 ${f.weeks.length}주 쓴 날 수`}>
                      {f.weeks.map((n, i) => (
                        <span
                          key={usage.weekStarts[i]}
                          className="admin-week"
                          title={`${usage.weekStarts[i]} 주 · ${n}일`}
                          style={{ '--fill': n === 0 ? 0 : 0.25 + (Math.min(n, 7) / 7) * 0.75 } as React.CSSProperties}
                        >
                          {n > 0 ? n : ''}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] leading-tight tabular-nums" style={{ color: 'var(--ink-soft)' }}>
                      28일 중 <b>{f.activeDays28}일</b>
                      <br />
                      세션 {f.sessions28}회
                    </span>
                  </div>
                  {limitText(f.limits, free.sessionsPerDay) && (
                    <div className="admin-limits">
                      한도에 닿음 · {limitText(f.limits, free.sessionsPerDay)}
                    </div>
                  )}
                </summary>
                <div className="px-4 pb-4 text-[12px]" style={{ color: 'var(--ink-soft)' }}>
                  <p className="mb-2">
                    가입 {f.signupDay} · 아이 {f.row.children_count}명 · 직접 넣은 세트 {f.row.sets_count}개 ·
                    끝까지 마친 세션 전체 {f.row.sessions_total}회
                    {f.row.last_sign_in_at && <> · 마지막 로그인 {f.row.last_sign_in_at.slice(0, 10)}</>}
                  </p>
                  {f.recent.length === 0 ? (
                    <p>최근 28일 동안 쓴 날이 없어요.</p>
                  ) : (
                    <table className="admin-days">
                      <thead>
                        <tr>
                          <th scope="col">날짜</th>
                          <th scope="col">세션</th>
                          <th scope="col">받아쓰기</th>
                          <th scope="col">맞춤법</th>
                          <th scope="col">시험</th>
                          <th scope="col">소리(자)</th>
                          <th scope="col">사진</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.recent.map((d) => (
                          <tr key={d.day}>
                            <td>{d.day.slice(5)}</td>
                            <td>{d.sessions || '—'}</td>
                            <td>{d.dictation || '—'}</td>
                            <td>{d.spelling || '—'}</td>
                            <td>{d.exams || '—'}</td>
                            <td>{d.tts_chars || '—'}</td>
                            <td>{d.ocr || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <p className="mb-6 px-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
        칸 하나가 한 주(월~일), 숫자는 그 주에 쓴 날 수예요. 맨 오른쪽이 이번 주. 줄을 누르면 날짜별로 펼쳐져요.
      </p>

      {/*
        출처마다 「얼마나 오나」와 「와서 남나」를 나란히 둡니다.
        많이 데려오는 곳과 오래 쓸 집을 데려오는 곳이 다를 수 있어서입니다.
      */}
      {/*
        로그인 전 체험(`/try`). 「써 봤다 → 끝까지 했다 → 가입하러 눌렀다」 어디서 새는지 봅니다.
        실제 가입 수는 위의 「가입한 집」과 아래 출처 표에 있습니다 — 여기 「가입 버튼」은 누른 횟수입니다.
      */}
      <h2 className="section-title mb-2">한 문장 써 보기 (로그인 전)</h2>
      {trialWeek && trialMonth ? (
        <div className="surface mb-2 overflow-x-auto">
          <table className="report-weeks">
            <thead>
              <tr>
                <th scope="col" className="report-weeks__name">
                  기간
                </th>
                <th scope="col">써 보기</th>
                <th scope="col">채점까지</th>
                <th scope="col">가입 버튼</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: '최근 7일', t: trialWeek },
                { label: '최근 28일', t: trialMonth },
              ].map(({ label, t }) => (
                <tr key={label}>
                  <th scope="row" className="report-weeks__name">
                    {label}
                  </th>
                  <td>
                    <b>{t.start}</b>
                  </td>
                  <td>
                    <b>{t.finish}</b>
                    <span className="report-weeks__n">{stepRate(t.finish, t.start)}</span>
                  </td>
                  <td>
                    <b>{t.cta}</b>
                    <span className="report-weeks__n">{stepRate(t.cta, t.finish)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="surface mb-2 p-4 text-sm" style={{ color: 'var(--ink-soft)' }}>
          체험 횟수를 불러오지 못했어요. 마이그레이션 0014 를 돌렸는지 확인해 주세요.
        </p>
      )}
      <p className="mb-6 px-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
        횟수만 세요 — 누가 했는지, 무엇을 썼는지는 남기지 않아요. 옆의 %는 바로 앞 단계 대비예요.
        한 번 들어와서 여러 문장을 해도 「써 보기」는 한 번이에요.
      </p>

      <h2 className="section-title mb-2">어디서 왔나</h2>
      <div className="surface mb-2 overflow-x-auto">
        <table className="report-weeks">
          <thead>
            <tr>
              <th scope="col" className="report-weeks__name">
                출처
              </th>
              <th scope="col">가입</th>
              <th scope="col">이번 주 씀</th>
              <th scope="col">핵심</th>
              <th scope="col">2주 뒤에도 씀</th>
            </tr>
          </thead>
          <tbody>
            {usage.sources.map((s) => (
              <tr key={s.source ?? '-'}>
                <th scope="row" className="report-weeks__name">
                  {sourceLabel(s.source)}
                </th>
                <td>
                  <b>{s.families}</b>
                </td>
                <td>{s.activeThisWeek || <span className="report-weeks__none">—</span>}</td>
                <td>{s.core || <span className="report-weeks__none">—</span>}</td>
                <td>
                  {s.retained14.eligible === 0 ? (
                    <span className="report-weeks__none">—</span>
                  ) : (
                    <>
                      <b>{Math.round((s.retained14.kept / s.retained14.eligible) * 100)}%</b>
                      <span className="report-weeks__n">
                        {s.retained14.kept}/{s.retained14.eligible}
                      </span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-6 px-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
        처음 들어온 곳 기준이에요. 링크에 <code>?from=insta</code> 처럼 꼬리표를 붙이면 정확해지고,
        없으면 들어온 사이트·앱으로 짐작해요. 출처를 적기 전에 가입한 집은 「모름」이에요.
      </p>

      <h2 className="section-title mb-2">가입한 주마다, 몇 주 뒤에도 쓰나</h2>
      <div className="surface mb-2 overflow-x-auto">
        <table className="report-weeks">
          <thead>
            <tr>
              <th scope="col" className="report-weeks__name">
                가입 주
              </th>
              <th scope="col">가입</th>
              {Array.from({ length: COHORT_OFFSETS }, (_, i) => (
                <th key={i} scope="col">
                  {i === 0 ? '그 주' : `${i}주 뒤`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usage.cohorts.map((c) => (
              <tr key={c.week}>
                <th scope="row" className="report-weeks__name">
                  {c.week.slice(5)}
                </th>
                <td>{c.signups || <span className="report-weeks__none">—</span>}</td>
                {c.retained.map((pct, i) => (
                  <td key={i}>
                    {pct === null ? <span className="report-weeks__none">—</span> : <b>{pct}%</b>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-6 px-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
        그 주에 가입한 집 중 그 주에 한 번이라도 쓴 비율이에요. 아직 오지 않은 주는 「—」.
      </p>
    </main>
  );
}

/** 한 집이 무료 한도의 어디에 닿았는지 짧게. 아무 데도 안 닿았으면 빈 문자열 */
function limitText(h: LimitHits, perDay: number | null): string {
  const parts: string[] = [];
  if (h.sessionDays > 0) parts.push(`하루 ${(perDay ?? 0) + 1}회+ ${h.sessionDays}일`);
  if (h.children) parts.push('아이 여럿');
  if (h.photo) parts.push('사진 넣기');
  return parts.join(' · ');
}
