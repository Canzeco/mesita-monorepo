import { Suspense } from "react";
import { SingleUnitConsole } from "../SingleUnitConsole";
import { Spinner } from "../ui";

export default async function ManageSingleUnitPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  return (
    <Suspense fallback={<Spinner label="Loading unit…" />}>
      <SingleUnitConsole unitId={unitId} />
    </Suspense>
  );
}
