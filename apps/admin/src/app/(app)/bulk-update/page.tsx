export default function BulkUpdateUnitsPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 pt-12 pb-14">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Units · Bulk
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Bulk update units
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
        Upload a CSV of venue IDs and fields to overwrite. The diff
        preview and confirm step land here next.
      </p>

      {/*
        TODO(atlas): Atlas pre-read toggle placeholder.
        Wire this up when the bulk-update EF is built. The toggle's
        boolean value must be passed as a `preReadSnapshots` (or similar)
        param on the batch EF call so the server can decide whether to
        pre-read prior snapshots or fetch from scratch. The toggle below
        is currently a static visual stub — no state, no action.
      */}
      <div className="border-border bg-card mt-8 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-tight">
              Pre-read research snapshots
            </p>
            <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
              When ON, each refresh reads the venue&apos;s existing Storage
              snapshots first and only fetches what&apos;s missing or
              stale. When OFF, every venue in the batch is re-researched
              from scratch. Snapshots are saved either way.
            </p>
          </div>
          {/* Static visual stub — to be wired in a later PR */}
          <span
            aria-hidden
            className="bg-muted relative inline-flex h-7 w-12 shrink-0 items-center rounded-full opacity-60"
          >
            <span className="bg-background ml-1 inline-block h-5 w-5 rounded-full shadow" />
          </span>
        </div>
        <p className="text-muted-foreground mt-3 text-[10px] tracking-wide uppercase italic">
          Stub — wire to batch EF param when bulk-update ships
        </p>
      </div>
    </div>
  );
}
