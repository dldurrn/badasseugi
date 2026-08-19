/**
 * 빈 화면.
 * 비어 있음을 알리는 데서 끝내지 않고 다음 행동을 제안합니다.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded px-6 py-10 text-center"
      style={{ border: '1px dashed var(--rule-strong)' }}
    >
      <p className="display text-base font-bold">{title}</p>
      {description && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
