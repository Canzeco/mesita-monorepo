import { permanentRedirect } from "next/navigation";

// /aura-config → /aura-consumers (page moved out of Configs into Manage,
// 2026-08-09). Catch-all shim: bookmarks, the Notion Configs registry and old
// tabs keep working. Aura was never a config — it is a roster of consumers.
export default async function AuraConfigLegacyRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  permanentRedirect(
    `/aura-consumers${slug?.length ? `/${slug.join("/")}` : ""}`,
  );
}
