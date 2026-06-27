import { redirect } from "next/navigation";
import { isUnitSection, unitSectionHref } from "../nav";

export default async function ManageSingleUnitPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { projectId } = await params;
  const { section } = await searchParams;
  const target = isUnitSection(section) ? section : "place";
  redirect(unitSectionHref(projectId, target));
}
