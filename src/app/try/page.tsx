import type { Metadata } from 'next';
import { TrialLanding } from '@/components/TrialLanding';

/*
  로그인 안 한 사람이 맨 주소(`/`)로 오면 프록시가 여기로 보냅니다.
  검색 엔진도 여기를 봅니다 — 예전에는 우리 사이트가 로그인 화면으로만 잡혔습니다.
*/
export const metadata: Metadata = {
  title: '받아쓰기 공책 · 아이 혼자 듣고 쓰고 채점받는 받아쓰기',
  description:
    '급수표를 사진으로 넣으면 아이가 혼자 듣고 원고지에 쓰고, 틀린 곳을 한 글자씩 짚어 받아요. 가입 없이 한 문장 써 보세요.',
  alternates: { canonical: '/try' },
};

export default function TryPage() {
  return <TrialLanding />;
}
