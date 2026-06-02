// Modal routes can fetch server-side data. Render an immediate shell-scoped
// overlay while loading so top/bottom chrome doesn't visually jump.
export default function ModalLoading() {
  return (
    <div className="bg-background absolute inset-0 z-50">
      <div className="bg-background/85 flex items-center gap-2 px-3 py-3 backdrop-blur">
        <div className="bg-muted h-9 w-9 rounded-full" />
        <div className="bg-muted h-4 w-32 rounded" />
      </div>
    </div>
  );
}
