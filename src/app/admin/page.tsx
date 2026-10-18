import { notFound } from 'next/navigation';
import {
  activitySince,
  buildUsage,
  COHORT_OFFSETS,
  STATUS_LABEL,
  type AdminActivityRow,
  type AdminFamilyRow,
  type UsageStatus,
} from '@/lib/admin-usage';
import { readActiveProfile } from '@/lib/profile-server';
import { sourceLabel } from '@/lib/source';
import { createClient } from '@/lib/supabase/server';

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
export default async function AdminPage() {
  const { view } = await readActiveProfile();
  if (view !== 'parent') notFound();

  const supabase = await createClient();
  const [admin, fams, acts] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.rpc('admin_families'),
    supabase.rpc('admin_activity', { since: activitySince() }),
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

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => (
          <span key={s} className="admin-status" data-status={s}>
            {STATUS_LABEL[s]} {statusCounts[s]}
          </span>
        ))}
      </div>

      <h2 className="section-title mb-2">집마다</h2>
      {usage.families.length === 0 ? (
        <p className="surface mb-6 p-5 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          아직 가입한 집이 없어요. 링크를 나눈 뒤 다시 와 보세요.
        </p>
      ) : (
        <ul className="surface mb-2 flex flex-col divide-y p-0" style={{ borderColor: 'var(--rule)' }}>
          {usage.families.map((f) => (
            <li key={f.row.family_id}>
              <details className="admin-family">
                <summary className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="admin-status" data-status={f.status}>
                      {STATUS_LABEL[f.status]}
                    </span>
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
