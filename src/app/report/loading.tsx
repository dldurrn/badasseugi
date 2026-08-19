import { LoadingCells } from '@/components/LoadingCells';

/** 리포트는 조회가 많아 가장 오래 걸립니다. 무엇을 기다리는지 밝혀 둡니다. */
export default function Loading() {
  return (
    <main className="page">
      <header className="mb-4 pt-4">
        <h1 className="display text-2xl font-bold">리포트</h1>
      </header>
      <LoadingCells label="기록을 모으고 있어요" />
    </main>
  );
}
