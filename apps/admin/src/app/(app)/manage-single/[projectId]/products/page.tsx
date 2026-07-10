import { redirect } from "next/navigation";

/** Products now live on the Place tab — keep the old URL working. */
export default async function UnitProductsRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/manage-single/${projectId}/place`);
}
