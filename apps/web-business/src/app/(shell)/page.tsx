// Org home = Activity, with an orientation band first (Design D1): who you
// are, where you stand on the ladder, today's three numbers — THEN the
// stream. Place chips filter server-side via ?place=.
import Link from "next/link";
import { CalendarClock, ReceiptText, ShoppingBag, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { MockChip, RungBadge, StatTile } from "@/components/console/badges";
import { RungStrip } from "@/components/console/RungStrip";
import { formatMxn } from "@/lib/model/format";
import { getOrg, resolveOrgKey } from "@/lib/mock";
import { withOrg } from "@/lib/console-routes";
import type { EventKind } from "@/lib/model/types";

const KIND_ICON: Record<EventKind, React.ReactNode> = {
  ticket: <ReceiptText className="text-muted-foreground h-4 w-4" />,
  reservation: <CalendarClock className="text-muted-foreground h-4 w-4" />,
  order: <ShoppingBag className="text-muted-foreground h-4 w-4" />,
};

export default async function OrgHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const orgKey = resolveOrgKey(sp.org);
  const data = getOrg(sp.org);
  const placeFilter =
    typeof sp.place === "string" &&
    data.places.some((p) => p.id === sp.place)
      ? sp.place
      : null;
  const events = placeFilter
    ? data.events.filter((e) => e.placeId === placeFilter)
    : data.events;
  const placeName = (id: string) =>
    data.places.find((p) => p.id === id)?.name ?? id;

  return (
    <>
      {/* Anchor band */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {data.organization.name}
            </h1>
            <RungBadge rung={data.organization.rung} />
          </div>
          <MockChip />
        </div>
        <RungStrip rung={data.organization.rung} />
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Covers today" value={String(data.statsToday.covers)} />
        <StatTile
          label="Discounts funded"
          value={formatMxn(data.statsToday.discountsFundedCents)}
          hint="today, across all places"
        />
        <StatTile
          label="Credits owed"
          value={formatMxn(data.paymentAccount.creditsLiabilityCents)}
          hint="outstanding balance"
        />
      </div>

      <section aria-label="Activity" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display mr-1 text-sm font-semibold tracking-tight">
            Activity
          </h2>
          <Link
            href={withOrg("/", orgKey)}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium transition",
              !placeFilter
                ? "bg-foreground text-background"
                : "border-border text-muted-foreground border",
            )}
          >
            All places
          </Link>
          {data.places.map((p) => (
            <Link
              key={p.id}
              href={`${withOrg("/", orgKey)}${orgKey === "grupo-ruiz" ? "?" : "&"}place=${p.id}`}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium transition",
                placeFilter === p.id
                  ? "bg-foreground text-background"
                  : "border-border text-muted-foreground border",
              )}
            >
              {p.name}
            </Link>
          ))}
        </div>

        {events.length === 0 ? (
          <EmptyState
            icon={<Store className="text-muted-foreground h-5 w-5" />}
            title="Nothing yet"
            description="Tickets, reservations and orders will land here the moment a guest shows up."
          />
        ) : (
          <div className="border-border bg-card rounded-2xl border px-4">
            {events.map((e) => (
              <div
                key={e.id}
                className="border-border/60 flex items-center gap-3 border-b py-3 last:border-b-0"
              >
                {KIND_ICON[e.kind]}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.label}</p>
                  <p className="text-muted-foreground text-[12px]">
                    {placeName(e.placeId)} · {e.at}
                  </p>
                </div>
                <div className="text-right">
                  {e.amountCents !== null && (
                    <p className="text-sm font-semibold">
                      {formatMxn(e.amountCents)}
                    </p>
                  )}
                  {e.discountPct !== null && (
                    <p className="text-muted-foreground text-[12px]">
                      {e.discountPct}% off
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
