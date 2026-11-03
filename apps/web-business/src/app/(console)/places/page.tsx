import Link from "next/link";
import { Store } from "lucide-react";
import { getIdentityCached } from "@/lib/identity";
import { PageHeader, Card } from "@/components/shell/Page";
import { PageErrorState } from "@/components/ui/PageErrorState";
import type { MyPlaceState } from "@/lib/business-api";
import { ClaimSearch } from "@/components/claim/ClaimSearch";
import { PLACES, claimHref, placeTabHref } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Places" };

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
    return <PageErrorState heading="Could not load your places" message={identity.error} retryHref={PLACES} />;
  }
  const { places } = identity.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Places" sub="Yours are the places you run on Mesita. All is every other place: find yours and claim it." />
      {/* Two columns (Pato, MESITA-3151: "places you manage vs places you
          don't manage, but in one word"): Yours, then All, the search
          (MESITA-3126). Everyone, staff included, claims a place before
          opening it (MESITA-3142). */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">Yours</h2>
            <p className="text-muted-foreground text-sm">The places you run. Each has its profile, its Premier and its settings.</p>
          </div>
          {places.length === 0 ? (
            <div className="bg-muted/50 flex flex-col items-center gap-2 rounded-2xl px-5 py-8 text-center">
              <Store className="text-muted-foreground size-6" aria-hidden />
              <p className="font-semibold">You don&apos;t run a place on Mesita yet.</p>
              <p className="text-muted-foreground max-w-xs text-sm">Find it under All and claim it.</p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {places.map((p) => (
                <li key={p.place_id} className="flex items-center gap-4 px-1 py-3">
                  {p.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="bg-muted size-12 shrink-0 rounded-xl" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name ?? "Unnamed place"}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {STATE_COPY[p.state]}
                      {p.state === "owner" && day(p.expires_at) ? ` · until ${day(p.expires_at)}` : ""}
                    </p>
                    {p.state === "rejected" && p.decision_note ? (
                      <p className="text-muted-foreground mt-1 text-sm">&ldquo;{p.decision_note}&rdquo;</p>
                    ) : null}
                  </div>
                  {p.state === "owner" ? (
                    <Link
                      href={placeTabHref(p.place_id, "profile")}
                      className="bg-foreground text-background shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold"
                    >
                      Open
                    </Link>
                  ) : p.state === "expired" || p.state === "rejected" ? (
                    <Link href={claimHref(p.place_id)} className="border-border shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold">
                      Claim again
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <ClaimSearch />
      </div>
    </div>
  );
}
