import { ProfilePicker } from '@/components/ProfilePicker';
import { isParentLocked, listChildren } from '@/lib/profile-server';

export const metadata = { title: '누가 공부할까요 · 받아쓰기 공책' };

/**
 * 프로필 선택 — 로그인 다음에 오는 첫 화면.
 *
 * 목록은 서버에서 읽고 PIN 해시는 걸러 낸 뒤 내려보냅니다(profile-server).
 */
export default async function ChildrenPage() {
  const [profiles, parentLocked] = await Promise.all([listChildren(), isParentLocked()]);

  return (
    <main className="page">
      <header className="pb-6 pt-10 text-center">
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--grid-deep)' }}>
          누가 공부할까요?
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-soft)' }}>
          내 얼굴을 눌러 주세요
        </p>
      </header>

      <ProfilePicker profiles={profiles} parentLocked={parentLocked} />
    </main>
  );
}
