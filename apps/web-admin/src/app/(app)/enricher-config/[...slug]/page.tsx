import { permanentRedirect } from "next/navigation";

// Every retired Enrichment subpath — config, triggers, calculator, playground —
// lands on the one page. The old tabs are boxes on it now; the calculator keeps
// an anchor so deep links still reach it.
//
// MUST stay the REQUIRED `[...slug]`, never `[[...slug]]`: the index is a real
// page now, and the optional form would collide with it.
export default async function EnrichmentLegacyRedirect({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  if (slug[0] === "calculator" || slug[0] === "playground") {
    permanentRedirect("/enricher-config#calculator");
  }
  permanentRedirect("/enricher-config");
}
