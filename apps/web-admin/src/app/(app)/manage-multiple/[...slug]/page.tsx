import { permanentRedirect } from "next/navigation";

// Retired Manage Multiple subpaths. Required `[...slug]` so live search /
// create / enrich (and the index → search redirect) stay authoritative.
export default async function ManageMultipleLegacyRedirect({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  if (slug[0] === "update") {
    permanentRedirect("/manage-multiple/enrich");
  }
  // catalog | anything else → Search (first tool)
  permanentRedirect("/manage-multiple/search");
}
