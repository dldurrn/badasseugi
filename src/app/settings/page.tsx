import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ParentLockSettings } from '@/components/ParentLockSettings';
import { SignOutButton } from '@/components/SignOutButton';
import { SoundToggle } from '@/components/SoundToggle';
import { RateSettings } from '@/components/RateSettings';
import { TtsStatus } from '@/components/TtsStatus';
import { VoiceSettings } from '@/components/VoiceSettings';
import { WriteModeSettings } from '@/components/WriteModeSettings';
import { MAX_CHILDREN } from '@/lib/profile';
import { isParentLocked, listChildren, readActiveProfile } from '@/lib/profile-server';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: '설정 · 받아쓰기 공책' };

/**
 * 설정 — **보호자 화면에만 있습니다.**
 *
 * 예전에는 아이도 이 화면에 들어왔고, 앞의 세 덩이(효과음·읽는 속도·쓰기 방법)를
 * 부모와 똑같이 봤습니다. 그래서 「아이 설정」이 「부모 설정의 앞부분」처럼 보였습니다.
 *
 * 가르는 기준을 하나로 두었습니다 —
 * **지금 그 자리에서 바꾸는 것은 아이에게, 한 번 정해 두는 것은 부모에게.**
 *
 * - 읽는 속도는 세션 화면에 크게 있고 거기서 바꾸면 기억됩니다.
 *   설정에 또 두면 같은 것이 두 곳에 있어 어느 쪽이 진짜인지 헷갈립니다.
 * - 쓰기 방법은 아이가 만질 물건이 아닙니다. 쓰던 중에 바꾸면 채점이 뒤집힙니다
 *   (원고지 모드에서만 쉼표 규칙을 되돌리기 때문입니다).
 * - 효과음만 아이 몫으로 남겨 더보기에 스위치 하나로 두었습니다.
 *   아이가 설정에서 할 일이 그것 하나뿐인데 화면을 한 번 더 들어가게 할 이유가 없습니다.
 *
 * 안에서도 두 덩이로 나눕니다 — **아이가 푸는 방식**과 **집 관리**.
 * 여덟 덩이가 한 줄로 늘어서 있으면 뭘 찾으러 왔는지 잊게 됩니다.
 */
export default async function SettingsPage() {
  const { view } = await readActiveProfile();

  // 아이 화면에서 주소를 직접 쳐도 들어오지 못합니다. 여기에 아이가 볼 것은 없습니다.
  if (view !== 'parent') redirect('/more');

  const [profiles, parentLocked, email] = await Promise.all([
    listChildren(),
    isParentLocked(),
    createClient()
      .then((c) => c.auth.getUser())
      .then(({ data }) => data.user?.email ?? null),
  ]);

  return (
    <main className="page">
      <header className="mb-5 pt-4">
        <h1 className="display text-2xl font-bold">설정</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          보호자 화면이에요
        </p>
      </header>

      {/* ---------- 아이가 푸는 방식 ---------- */}
      <h2 className="group-title">아이가 푸는 방식</h2>

      {/* 소리가 기기 목소리로 새고 있으면 알립니다. 잘 나오면 아무것도 안 뜹니다. */}
      <TtsStatus />

      <RateSettings />

      {/* 음성 서비스가 설정되어 있을 때만 나타납니다 */}
      <VoiceSettings />

      <WriteModeSettings />

      <h3 className="section-title mb-2">효과음</h3>
      <div className="mb-6">
        {/* 아이 쪽 더보기에도 같은 스위치가 있습니다. 기기에 저장되는 값이라 같은 것을 봅니다. */}
        <SoundToggle />
      </div>

      {/* ---------- 집 관리 ---------- */}
      <h2 className="group-title">집 관리</h2>

      <h3 className="section-title mb-2">자녀 프로필</h3>
      <ul className="mb-3 flex flex-col gap-2">
        {profiles.map((profile) => (
          <li key={profile.id}>
            <Link
              href={`/children/${profile.id}/edit`}
              className="surface flex items-center gap-3 p-4"
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {profile.avatar}
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">{profile.nickname}</span>
                <span className="block text-xs" style={{ color: 'var(--ink-soft)' }}>
                  {profile.hasPin ? '비밀번호로 잠겨 있어요' : '비밀번호 없이 들어가요'}
                </span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--ink-faint)' }}>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {profiles.length === 0 && (
        <p className="mb-3 text-sm" style={{ color: 'var(--ink-soft)' }}>
          프로필을 추가하면 아이별로 기록이 따로 쌓여요.
        </p>
      )}

      {/*
        여기에 「프로필 바꾸기」도 있었습니다. 뺐습니다.

        같은 곳으로 가는 길이 홈 · 더보기 · 설정 세 군데였습니다.
        길이 많으면 편할 것 같지만, 「내가 아까 본 게 어디였지」를 만듭니다.
        홈 위쪽에 지금 누가 쓰는지가 늘 떠 있고 거기서 바로 바꿀 수 있으며,
        더보기에도 있습니다. 설정은 **관리하는 자리**라 추가만 남깁니다.
      */}
      {profiles.length < MAX_CHILDREN && (
        <div className="mb-6">
          <Link href="/children/new" className="btn btn-secondary btn-lg">
            프로필 추가
          </Link>
        </div>
      )}

      <h3 className="section-title mb-2">보호자 잠금</h3>
      <div className="mb-6">
        <ParentLockSettings locked={parentLocked} />
      </div>

      <h3 className="section-title mb-2">계정</h3>
      <div className="surface p-4">
        {/* 어느 계정으로 들어와 있는지 보여야 로그아웃을 안심하고 누를 수 있습니다. */}
        <p className="mb-1 px-1 text-xs" style={{ color: 'var(--ink-faint)' }}>
          로그인한 계정
        </p>
        <p className="mb-3 break-all px-1 text-[15px]">{email ?? '—'}</p>
        <div className="border-t pt-3" style={{ borderColor: 'var(--rule)' }}>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
