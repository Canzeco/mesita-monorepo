import { UnitEditShell } from "../UnitEditShell";

export default async function ManageSingleUnitLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  return <UnitEditShell unitId={unitId}>{children}</UnitEditShell>;
}
