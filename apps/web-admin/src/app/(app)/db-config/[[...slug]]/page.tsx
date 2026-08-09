import { permanentRedirect } from "next/navigation";

// /db-config → /manage-database (page moved out of Configs into Manage,
// 2026-08-09). Catch-all shim, same as the /scoring-config and /adea-config
// renames. It was never a config — the reset tool writes to the live backend.
export default async function DbConfigLegacyRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  permanentRedirect(
    `/manage-database${slug?.length ? `/${slug.join("/")}` : ""}`,
  );
}
