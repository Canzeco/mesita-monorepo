import { permanentRedirect } from "next/navigation";

// /aura-config → /aura-users (page moved out of Configs into the Users section
// 2026-08-09). Catch-all shim: bookmarks, the Notion Configs registry and old
// tabs keep working. Aura was never a config — it is a roster of people.
export default async function AuraConfigLegacyRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/aura-users${slug?.length ? `/${slug.join("/")}` : ""}`);
}
