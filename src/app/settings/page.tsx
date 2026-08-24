import Link from 'next/link';
import { ParentLockSettings } from '@/components/ParentLockSettings';
import { SignOutButton } from '@/components/SignOutButton';
import { SoundToggle } from '@/components/SoundToggle';
import { RateSettings } from '@/components/RateSettings';
import { VoiceSettings } from '@/components/VoiceSettings';
import { WriteModeSettings } from '@/components/WriteModeSettings';
import { MAX_CHILDREN } from '@/lib/profile';
import { isParentLocked, listChildren, readActiveProfile } from '@/lib/profile-server';
import { createClient } from '@/lib/supabase/server';

/**
 * 설정.
 *
 * 자녀 화면에서는 소리만 보여 줍니다.
 * 프로필 관리와 계정은 보호자 화면에만 둡니다(지침 9).
 */
export default async function SettingsPage() {
  const { view, child } = await readActiveProfile();
  const isParent = view === 'parent';

  const [profiles, parentLocked, email] = isParent
    ? await Promise.all([
        listChildren(),
        isParentLocked(),
        createClient()
          .then((c) => c.auth.getUser())
          .then(({ data }) => data.user?.email ?? null),
      ])
    : [[], false, null];

  return (
    <main className="page">
      <header className="mb-5 pt-4">
        <h1 className="display text-2xl font-bold">설정</h1>
        {!isParent && child && (
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            <span aria-hidden="true">{child.avatar} </span>
            {child.nickname}
          </p>
        )}
      </header>

      <h2 className="section-title mb-2">소리</h2>
      <div className="mb-6">
        <SoundToggle />
      </div>

      <RateSettings />

      {/* 음성 서비스가 설정되어 있을 때만 나타납니다 */}
      <VoiceSettings />

      <WriteModeSettings />

      {isParent ? (
        <>
          <h2 className="section-title mb-2">자녀 프로필</h2>
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

          <div className="mb-6 flex gap-2">
            {profiles.length < MAX_CHILDREN && (
              <Link href="/children/new" className="btn btn-secondary flex-1 justify-center">
                프로필 추가
              </Link>
            )}
            <Link href="/children" className="btn btn-secondary flex-1 justify-center">
              프로필 바꾸기
            </Link>
          </div>

          <h2 className="section-title mb-2">보호자 잠금</h2>
          <div className="mb-6">
            <ParentLockSettings locked={parentLocked} />
          </div>

          <h2 className="section-title mb-2">계정</h2>
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
        </>
      ) : (
        <>
          <h2 className="section-title mb-2">프로필</h2>
          <div className="surface p-4">
            <Link href="/children" className="btn btn-quiet w-full justify-start">
              프로필 바꾸기
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
