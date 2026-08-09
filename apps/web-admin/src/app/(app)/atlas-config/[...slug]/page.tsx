import { permanentRedirect } from "next/navigation";

// Retired Atlas Config subpaths → live homes. Catch-all shim so bookmarks and
// old Notion Configs registry links keep working. Required `[...slug]` (not
// optional) so `/atlas-config` stays on the live root page.tsx.
export default async function AtlasConfigLegacyRedirect({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const head = slug[0];
  if (head === "configuration") {
    permanentRedirect("/enricher-config/config");
  }
  if (head === "calculator") {
    permanentRedirect("/enricher-config/calculator");
  }
  // config | fields | playground | anything else → flat Atlas Config page
  permanentRedirect("/atlas-config");
}
