/**
 * 이 화면만 제목을 여기서 답니다.
 *
 * `page.tsx`가 `'use client'`라 거기에는 `metadata`를 둘 수 없습니다 —
 * 제목은 서버가 화면을 그리기 전에 정해져야 하기 때문입니다.
 * 감싸는 레이아웃은 서버 컴포넌트라 여기서는 됩니다.
 */
export const metadata = { title: '비밀번호 바꾸기 · 받아쓰기 공책' };

export default function PasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
