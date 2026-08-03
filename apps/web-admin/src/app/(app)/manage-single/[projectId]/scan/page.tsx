import { redirect } from "next/navigation";

/** The Scan tab was removed (MESITA-834) — keep the old URL working. */
export default async function UnitScanRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/manage-single/${projectId}/place`);
}
