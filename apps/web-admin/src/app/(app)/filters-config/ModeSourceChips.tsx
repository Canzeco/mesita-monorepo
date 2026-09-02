// Locked source chips on a Discovery mode card. Read-only: dispatch does
// not read a persistable set yet, so a toggle here would be STAGED.

export function ModeSourceChips({ sources }: { sources: readonly string[] }) {
  if (sources.length === 0) {
    return (
      <div className="text-muted-foreground mt-4 type-meta font-medium">None</div>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {sources.map((name) => (
        <span
          key={name}
          className="border-border bg-background text-foreground rounded-full border px-2.5 py-1 type-meta font-medium"
        >
          {name}
        </span>
      ))}
    </div>
  );
}
