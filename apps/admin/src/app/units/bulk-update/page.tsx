export default function BulkUpdateUnitsPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Bulk update units
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Upload a CSV of venue IDs + fields to overwrite. Bulk update + diff
        preview lands here next.
      </p>
    </div>
  );
}
