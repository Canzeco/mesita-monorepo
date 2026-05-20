export default function BulkCreateUnitsPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 pt-12 pb-14">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Units · Bulk
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Bulk create units
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
        Paste a list of Google Place IDs or upload a CSV. The bulk
        enrichment + insert pipeline lands here next.
      </p>
    </div>
  );
}
