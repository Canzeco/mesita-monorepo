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
    </div>
  );
}
