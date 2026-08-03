import { redirect } from "next/navigation";

/** Team folded into Settings (MESITA-834 follow-up) — keep the old URL working. */
export default async function UnitTeamRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/manage-single/${projectId}/settings`);
}
