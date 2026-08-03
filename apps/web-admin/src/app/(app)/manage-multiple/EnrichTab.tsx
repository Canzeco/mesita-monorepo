import { Sparkles } from "lucide-react";

// Manage Multiple Units → Bulk Enrich. Still a placeholder, but an honest
// one: the label says enrich, so the copy describes enrichment (the bulk twin
// of the per-place Re-enrich button) rather than the CSV field-overwrite
// feature the old "Bulk Update" placeholder advertised and nobody built.
export function EnrichTab() {
  return (
    <div>
      <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
        Re-run the Enricher over many places at once — the bulk twin of the
        Re-enrich button on a single place. Pick places, choose how deep to go,
        and see the cost before anything runs.
      </p>

      <section className="border-border bg-card mt-8 flex flex-col items-center gap-4 rounded-2xl border p-10 text-center">
        <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
          <Sparkles className="h-5 w-5" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Coming soon
        </h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Bulk enrichment with a cost estimate before commit — a full pass burns
          Apify, Perplexity and Firecrawl per place, so this ships with the
          spend shown up front.
        </p>
      </section>
    </div>
  );
}
