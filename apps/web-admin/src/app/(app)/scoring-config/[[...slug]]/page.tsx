import { permanentRedirect } from "next/navigation";

// /scoring-config → /lineup-config (route renamed 2026-07-20, MESITA-696).
// Catch-all shim: every legacy URL — bookmarks, the Notion Configs registry,
// old tabs — lands on the same subpath under the new route.
export default async function ScoringConfigLegacyRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/lineup-config${slug?.length ? `/${slug.join("/")}` : ""}`);
}
