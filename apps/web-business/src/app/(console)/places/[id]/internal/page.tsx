import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { listVerifications } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { VerificationQueue } from "@/components/internal/VerificationQueue";
import { InternalCards } from "./InternalCards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mesita staff" };

// Mesita staff only (MESITA-3103, MESITA-3104). The data is staff-only at the
// source: business-web-get-place adds the internal fields only for a
// super-admin, and every door these cards write through is a
// business-web-* EF that refuses anyone else. This page also 404s for an
// owner so the view is never drawn empty.
export default async function InternalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage || manage.role !== "superadmin") notFound();
  const queue = await listVerifications(id);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <InternalCards />
      <Card>
        <p className="mb-3 font-semibold">Who runs this place</p>
        {queue.ok ? (
          <VerificationQueue owners={queue.data.owners} pending={queue.data.pending} showPlace={false} />
        ) : (
          <p className="text-destructive text-sm">{queue.error}</p>
        )}
      </Card>
    </div>
  );
}
