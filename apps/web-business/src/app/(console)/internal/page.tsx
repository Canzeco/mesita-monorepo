import { notFound } from "next/navigation";
import { getIdentityCached } from "@/lib/identity";
import { listVerifications } from "@/lib/business-api";
import { PageHeader, Card } from "@/components/shell/Page";
import { VerificationQueue } from "@/components/internal/VerificationQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Internal" };

// Every "I run this place" request waiting, across places (MESITA-3103).
// Mesita staff only: the EF refuses anyone else; this page 404s for them.
export default async function InternalQueuePage() {
  const identity = await getIdentityCached();
  if (!identity.ok || !identity.data.isSuperAdmin) notFound();
  const queue = await listVerifications();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Requests" sub="People who asked to run a place. Approve to give them its profile and Premier for a year." />
      <Card>
        {queue.ok ? (
          <VerificationQueue owners={[]} pending={queue.data.pending} showPlace />
        ) : (
          <p className="text-destructive text-sm">{queue.error}</p>
        )}
      </Card>
    </div>
  );
}
