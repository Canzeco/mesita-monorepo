import { redirect } from "next/navigation";
import { isPlaceSectionId, placeSectionHref } from "../nav";

export default async function ManageSinglePlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { projectId } = await params;
  const { section } = await searchParams;
  const target = isPlaceSectionId(section) ? section : "place";
  redirect(placeSectionHref(projectId, target));
}
