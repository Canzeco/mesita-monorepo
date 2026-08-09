import { permanentRedirect } from "next/navigation";

// Retired Enricher Config subpaths. Required `[...slug]` so live `config/` +
// `calculator/` (and the index → config redirect) stay authoritative.
// Mirrors `/adea-config`: playground was renamed Calculator.
export default async function EnricherConfigLegacyRedirect({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  if (slug[0] === "playground") {
    permanentRedirect("/enricher-config/calculator");
  }
  permanentRedirect("/enricher-config/config");
}
