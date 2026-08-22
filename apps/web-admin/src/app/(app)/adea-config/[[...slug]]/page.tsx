import { permanentRedirect } from "next/navigation";

// /adea-config → /enricher-config (route renamed when Atlas/Enricher split).
// Catch-all shim: bookmarks and old Notion Configs registry links keep working.
// Only /calculator maps to the Enricher calculator; everything else lands on config.
export default async function AdeaConfigLegacyRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  if (slug?.[0] === "calculator") {
    permanentRedirect("/enricher-config#calculator");
  }
  permanentRedirect("/enricher-config");
}
