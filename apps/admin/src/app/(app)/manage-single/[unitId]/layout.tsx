import { UnitEditShell } from "../UnitEditShell";

export default async function ManageSingleUnitLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <UnitEditShell projectId={projectId}>{children}</UnitEditShell>;
}
