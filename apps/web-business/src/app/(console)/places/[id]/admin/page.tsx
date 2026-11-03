import Link from "next/link";
import { notFound } from "next/navigation";
import { placeTabHref } from "@/lib/routes";
import { getManagePlace } from "@/lib/place-view";
import { listVerifications } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { VerificationQueue } from "@/components/admin/VerificationQueue";
import { AdminCards } from "./AdminCards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

// Mesita staff only (MESITA-3103, MESITA-3104). The data is staff-only at the
// source: business-web-get-place adds the internal fields only for a
// super-admin, and every door these cards write through is a
// business-web-* EF that refuses anyone else. This page also 404s for an
// owner so the view is never drawn empty.
export default async function AdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage || manage.role !== "superadmin") notFound();
  const queue = await listVerifications(id);

  return (
    // One masonry, three columns at xl (Pato, MESITA-3159: "keep the three
    // columns"): Verification is a card among the others.
    <AdminCards>
      {/* Verification only (MESITA-3157, Pato: "a box called Verification"):
          the owner, editors and Revoke are Settings' Team. */}
      <Card className="flex flex-col gap-4">
        <div>
          <p className="font-semibold">Verification</p>
          <p className="text-muted-foreground text-sm">Requests to run this place, and reports from the claim window. Approve or reject each.</p>
          <Link href={placeTabHref(id, "settings")} className="mt-1 inline-block text-sm font-semibold underline underline-offset-4">
            Who runs it is in Settings
          </Link>
        </div>
        {queue.ok ? (
          <VerificationQueue pending={queue.data.pending} />
        ) : (
          <p className="text-destructive text-sm">{queue.error}</p>
        )}
      </Card>
    </AdminCards>
  );
}
