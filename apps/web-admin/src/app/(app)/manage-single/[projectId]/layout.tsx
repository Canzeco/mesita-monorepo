import { PlaceEditShell } from "../PlaceEditShell";

export default async function ManageSinglePlaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <PlaceEditShell projectId={projectId}>{children}</PlaceEditShell>;
}
