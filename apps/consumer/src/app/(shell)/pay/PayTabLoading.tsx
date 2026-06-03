export function PayTabLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-4 pt-4 pb-6">
      <div className="bg-muted h-10 animate-pulse rounded-full" />
      <div className="bg-muted mt-4 h-40 animate-pulse rounded-lg" />
    </div>
  );
}
