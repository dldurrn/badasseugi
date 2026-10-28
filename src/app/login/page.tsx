import { LoginForm } from '@/components/LoginForm';

export const metadata = { title: '로그인 · 받아쓰기 공책' };

/**
 * 로그인 화면.
 *
 * 실패 사유(`?error=`)를 서버에서 받아 넘깁니다.
 * useSearchParams 대신 이 방식을 쓰면 Suspense 경계가 필요 없습니다.
 * `?start=signup` 은 체험 화면의 가입 버튼이 붙입니다.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; start?: string }>;
}) {
  const { error, start } = await searchParams;
  return <LoginForm callbackError={error} startWithSignup={start === 'signup'} />;
}
