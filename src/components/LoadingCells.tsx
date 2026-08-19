/**
 * 기다리는 중 표시.
 *
 * 화면을 옮길 때마다 서버를 한 번 다녀옵니다(100~250ms).
 * 그동안 아무 변화가 없으면 아이는 버튼이 안 눌렸다고 생각해 다시 누릅니다.
 * 빙글빙글 도는 것 대신 이 앱의 소재인 원고지 칸을 씁니다.
 *
 * `prefers-reduced-motion`은 globals.css가 전역으로 처리합니다.
 */
export function LoadingCells({ label = '불러오는 중이에요' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="grid-cell cell-breathe"
            style={{
              width: 26,
              height: 26,
              // 칸마다 시작을 어긋내면 물결처럼 이어집니다.
              animationDelay: `${i * 0.16}s`,
              borderColor: 'rgba(46, 125, 91, 0.32)',
              background: 'var(--grid-tint)',
            }}
          />
        ))}
      </div>
      <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>
        {label}
      </p>
    </div>
  );
}
