export default function BulkCreateUnitsPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Bulk create units
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Paste a list of Google Place IDs or upload a CSV. Bulk enrichment +
        insert lands here next.
      </p>
    </div>
  );
}
