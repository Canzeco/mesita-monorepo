import { redirect } from "next/navigation";
import { isUnitSection, unitSectionHref } from "../nav";

export default async function ManageSingleUnitPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { unitId } = await params;
  const { section } = await searchParams;
  const target = isUnitSection(section) ? section : "place";
  redirect(unitSectionHref(unitId, target));
}
