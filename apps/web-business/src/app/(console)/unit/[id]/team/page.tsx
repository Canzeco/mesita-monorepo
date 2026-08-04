import { redirect } from "next/navigation";

// Team folded into the per-place Settings tab (MESITA-843) — four tabs only.
export default async function TeamFoldedIntoSettingsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/unit/${id}/settings`);
}
