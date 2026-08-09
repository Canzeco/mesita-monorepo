// Shown while the RSC awaits check-web-get-ticket. The page is
// force-dynamic and the waiter is standing at the table, so a blank screen
// reads as "the QR is broken" — this keeps the card's shape on screen.

export default function CheckLoading() {
  return (
    <main className="bg-background min-h-dvh px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div
          role="status"
          aria-label="Cargando el ticket"
          className="border-border bg-card animate-pulse overflow-hidden rounded-2xl border shadow-sm"
        >
          <div className="border-border bg-muted/40 flex items-center justify-between gap-3 border-b px-5 py-3.5">
            <div className="bg-muted h-5 w-32 rounded-md" />
            <div className="bg-muted h-4 w-20 rounded-md" />
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-2">
              <div className="bg-muted h-5 w-40 rounded-md" />
              <div className="bg-muted h-4 w-52 rounded-md" />
            </div>
            <div className="bg-muted h-7 w-44 rounded-full" />
            <div className="border-border bg-muted/30 flex flex-col gap-3 rounded-xl border p-4">
              <div className="bg-muted h-4 w-full rounded-md" />
              <div className="bg-muted h-4 w-3/4 rounded-md" />
              <div className="bg-muted h-8 w-1/2 self-end rounded-md" />
            </div>
            <div className="bg-muted h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
