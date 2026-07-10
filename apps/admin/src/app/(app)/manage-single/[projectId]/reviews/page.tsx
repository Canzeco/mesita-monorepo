import { redirect } from "next/navigation";

/** Reviews now live on the Place tab — keep the old URL working. */
export default async function UnitReviewsRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/manage-single/${projectId}/place`);
}
