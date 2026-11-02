import Link from "next/link";
import { Plus, Store } from "lucide-react";
import { getIdentityCached } from "@/lib/identity";
import { PageHeader, Card } from "@/components/shell/Page";
import { PageErrorState } from "@/components/ui/PageErrorState";
import type { MyPlaceState } from "@/lib/business-api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your places" };

const STATE_COPY: Record<MyPlaceState, string> = {
  owner: "You run this place",
  pending: "Mesita is reviewing your request",
  expired: "Your verification ended. Claim it again.",
  rejected: "Not approved",
};

function day(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PlacesPage() {
  const identity = await getIdentityCached();
  if (!identity.ok) {
    return <PageErrorState heading="Could not load your places" message={identity.error} retryHref="/places" />;
  }
  const { places } = identity.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your places"
        sub="The places you run on Mesita. Each one has its profile, its Premier and its settings."
        right={
          <Link href="/claim" className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold">
            <Plus className="size-4" aria-hidden /> Claim a place
          </Link>
        }
      />
      {places.length === 0 ? (
        <Card className="flex flex-col items-start gap-3">
          <Store className="text-muted-foreground size-6" aria-hidden />
          <p className="font-semibold">You don&apos;t run a place on Mesita yet.</p>
          <p className="text-muted-foreground text-sm">Find your place and claim it. Mesita reviews every request, usually within a day.</p>
          <Link href="/claim" className="text-sm font-semibold underline underline-offset-4">Claim your place</Link>
        </Card>
      ) : (
        <Card className="divide-border divide-y p-0 sm:p-0">
          {places.map((p) => {
            const open = p.state === "owner";
            const body = (
              <div className="flex items-center gap-4 px-5 py-4">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="bg-muted size-12 shrink-0 rounded-xl" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name ?? "Unnamed place"}</p>
                  <p className="text-muted-foreground text-sm">
                    {STATE_COPY[p.state]}
                    {p.state === "owner" && day(p.expires_at) ? ` · until ${day(p.expires_at)}` : ""}
                  </p>
                  {p.state === "rejected" && p.decision_note ? (
                    <p className="text-muted-foreground mt-1 text-sm">&ldquo;{p.decision_note}&rdquo;</p>
                  ) : null}
                </div>
                {p.state === "expired" || p.state === "rejected" ? (
                  <Link href={`/claim/${encodeURIComponent(p.place_id)}`} className="text-sm font-semibold underline underline-offset-4">
                    Claim again
                  </Link>
                ) : null}
              </div>
            );
            return open ? (
              <Link key={p.place_id} href={`/places/${encodeURIComponent(p.place_id)}/profile`} className="hover:bg-muted/50 block transition">
                {body}
              </Link>
            ) : (
              <div key={p.place_id}>{body}</div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
