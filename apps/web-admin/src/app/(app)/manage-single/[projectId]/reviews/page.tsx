import { redirect } from "next/navigation";

/** Reviews folded into Performance (per Pato) — keep the old URL working. */
export default async function UnitReviewsRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/manage-single/${projectId}/performance`);
}
