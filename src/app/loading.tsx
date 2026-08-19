import { LoadingCells } from '@/components/LoadingCells';

/**
 * 모든 화면의 기본 기다림 표시.
 *
 * 하위 경로에 loading.tsx가 따로 없으면 이것이 쓰입니다.
 * 화면마다 다른 문구가 필요하면 그 폴더에 loading.tsx를 새로 두세요.
 */
export default function Loading() {
  return (
    <main className="page">
      <LoadingCells />
    </main>
  );
}
