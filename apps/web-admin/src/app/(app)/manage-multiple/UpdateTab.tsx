import { ListChecks } from "lucide-react";

export function UpdateTab() {
  return (
    <div>
      <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
        Upload a CSV of place IDs and fields to overwrite. The diff
        preview and confirm step land here next.
      </p>

      <section className="border-border bg-card mt-8 flex flex-col items-center gap-4 rounded-2xl border p-10 text-center">
        <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
          <ListChecks className="h-5 w-5" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Coming soon
        </h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Bulk field overwrites with a diff preview before commit.
        </p>
      </section>
    </div>
  );
}
