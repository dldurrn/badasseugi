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
import { DEFAULT_SETTINGS, cleanRate, cleanWriteMode } from '@/lib/settings';
import { readSettings } from '@/lib/settings-server';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: '설정 · 받아쓰기 공책' };

/**
 * 설정 — 부모와 아이가 **같은 화면을 다르게 씁니다.**
 *
 *   부모 — 기본값을 정합니다. 아이가 따로 안 골랐으면 이걸 씁니다.
 *   아이 — 자기 것을 고릅니다. 고르는 순간 부모 기본값에서 벗어납니다.
 *
 * 값은 **서버에 둡니다**(0006_settings.sql). 예전에는 기기 한 곳에 통으로 저장해
 * 아이가 둘이면 한 값을 같이 썼고, 부모 휴대폰에서 정한 것이 아이 패드로 넘어가지 않았습니다.
 *
 * 효과음만 기기에 그대로 둡니다 — 「지금 조용히 해야 하나」는
 * 아이의 성향이 아니라 그 순간의 사정이라 기기를 따라가는 편이 맞습니다.
 *
 * 보호자 쪽은 두 덩이로 나눕니다 — **아이가 푸는 방식**과 **집 관리**.
 * 여덟 덩이가 한 줄로 늘어서 있으면 뭘 찾으러 왔는지 잊게 됩니다.
 */
export default async function SettingsPage() {
  const { view, child } = await readActiveProfile();

  /*
    아이도 이 화면에 들어옵니다 — 다만 **자기 것만** 봅니다.

    한 번 뒤집힌 판단입니다. 처음에는 아이가 바꿀 것이 효과음 하나뿐이라
    화면을 없애고 더보기에 스위치로 뒀습니다.
    그런데 아이가 여럿이면 목소리와 쓰기 방법도 아이마다 달라야 한다는 것이 분명해졌습니다 —
    형은 남자 목소리를, 동생은 원고지 대신 그냥 쓰기를 쓸 수 있어야 합니다.
    바꿀 것이 셋이 되니 화면 하나가 다시 값을 합니다. 목소리 고르기는 특히 길어서
    더보기에 그냥 붙이면 다른 항목이 다 밀립니다.

    부모와 아이가 **같은 화면을 다르게 씁니다.**
      부모 — 기본값을 정합니다. 아이가 안 골랐으면 이걸 씁니다.
      아이 — 자기 것을 고릅니다. 고르는 순간 부모 기본값에서 벗어납니다.
  */
  if (view === 'child') return <ChildSettings childName={child?.nickname ?? null} />;
  if (view !== 'parent') redirect('/children');

  const [profiles, parentLocked, email, settings] = await Promise.all([
    listChildren(),
    isParentLocked(),
    createClient()
      .then((c) => c.auth.getUser())
      .then(({ data }) => data.user?.email ?? null),
    readSettings(),
  ]);

  /*
    보호자 화면에서 고치는 것은 **기본값**입니다.
    아이가 자기 화면에서 따로 고르면 그 아이는 자기 것을 씁니다.

    그래서 여기 켜져 보이는 값은 「지금 이 아이에게 적용된 값」이 아니라
    「내가 정해 둔 기본값」입니다. 안 정했으면 앱 기본값을 켜서 보여 줍니다 —
    아무것도 안 켜져 있으면 「그럼 지금 뭘로 읽지?」가 됩니다.
  */
  const 기본속도 = cleanRate(settings.family.rate) ?? DEFAULT_SETTINGS.rate;
  const 기본쓰기 = cleanWriteMode(settings.family.writeMode) ?? DEFAULT_SETTINGS.writeMode;
  const 기본목소리 = settings.family.voice ?? null;

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

      <RateSettings scope="family" value={기본속도} />

      {/* 음성 서비스가 설정되어 있을 때만 나타납니다 */}
      <VoiceSettings scope="family" value={기본목소리} rate={기본속도} />

      <WriteModeSettings scope="family" value={기본쓰기} />

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

/**
 * 아이가 보는 설정 — **자기 것만** 있습니다.
 *
 * 여기서 고르면 그 아이 것으로 저장되고, 그 순간부터 부모 기본값을 따르지 않습니다.
 * 형제가 같은 기기를 써도 서로의 설정을 건드리지 않습니다.
 *
 * 켜져 보이는 값은 **지금 실제로 적용된 값**입니다 —
 * 자기가 고른 게 있으면 그것, 없으면 부모가 정해 둔 기본값.
 * 「내가 안 골랐음」을 굳이 드러내지 않습니다. 아이에게는 지금 뭘로 읽는지가 전부입니다.
 *
 * 속도는 여기 없습니다. 받아쓰기 화면에 크게 있고 거기서 바꾸면 기억됩니다 —
 * 「이 문장 잘 안 들려」는 문제를 푸는 그 자리에서 생기는 일이라 거기가 맞습니다.
 */
async function ChildSettings({ childName }: { childName: string | null }) {
  const settings = await readSettings();

  return (
    <main className="page">
      <header className="mb-5 pt-4">
        <h1 className="display text-2xl font-bold">설정</h1>
        {childName && (
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            {childName}
          </p>
        )}
      </header>

      <h3 className="section-title mb-2">효과음</h3>
      <div className="mb-6">
        <SoundToggle />
      </div>

      <VoiceSettings
        scope="child"
        value={settings.effective.voice}
        rate={settings.effective.rate}
      />

      <WriteModeSettings scope="child" value={settings.effective.writeMode} />
    </main>
  );
}
