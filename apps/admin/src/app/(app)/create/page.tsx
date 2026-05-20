export default function CreateUnitPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 pt-12 pb-14">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Units · Single
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Manually create unit
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
        Add a single venue by hand. The Google Places picker plus the
        enrichment pass (Firecrawl + OpenAI) land here next.
      </p>
    </div>
  );
}
