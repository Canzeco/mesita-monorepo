"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { getPlaceBoost, type AdminBacking, type AdminPlaceBoost } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";

// Single Place › Premier (MESITA-2789; Boost renamed Premier, MESITA-2925).
// The place's paid tier and every guest subscription behind it, read from
// admin-web-get-place-boost. Premier is paid visibility; nothing here
// grants, cancels or refunds — the payer manages their own in the consumer
// app, and Stripe is the record.

const TIER_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "Not Premier",
  1: "Premier 2X",
  2: "Premier 5X",
  3: "Premier 10X",
};

const BACKING_TIER_LABEL: Record<AdminBacking["tier"], string> = {
  boost_2x: "Premier 2X",
  boost_5x: "Premier 5X",
  boost_10x: "Premier 10X",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

function day(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground type-label">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function statusLabel(b: AdminBacking): string {
  if (b.live && b.cancel_at_period_end) return "Ends at period end";
  if (b.live) return "Active";
  return b.status.replace(/_/g, " ");
}

export function BoostSection({ placeId }: { placeId: string }) {
  const [data, setData] = useState<AdminPlaceBoost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((r: Awaited<ReturnType<typeof getPlaceBoost>>) => {
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setData(r.data);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    apply(await getPlaceBoost(placeId));
  }, [apply, placeId]);

  useEffect(() => {
    // Initial read: every state update lands after the await (Next 16
    // lints a synchronous setState in an effect body).
    let alive = true;
    void getPlaceBoost(placeId).then((r) => {
      if (alive) apply(r);
    });
    return () => {
      alive = false;
    };
  }, [apply, placeId]);

  const testMode = data?.backings.some((b) => !b.livemode) ?? false;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={<Zap className="h-4 w-4" />}
        tint="amber"
        title="Premier"
        subtitle="Paid visibility a guest bought for this place. Marked Premier."
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Reload Premier"
            className="text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-50"
          >
            <RefreshCw className={"h-4 w-4" + (loading ? " animate-spin" : "")} />
          </button>
        }
      >
        {error ? (
          <p role="alert" className="text-destructive mt-3 text-sm">
            {error}
          </p>
        ) : !data ? (
          <p className="text-muted-foreground mt-3 text-sm">Loading…</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Tier" value={TIER_LABEL[data.tier]} />
            <Stat label="Map factor" value={`×${data.factor}`} />
            <Stat label="Paid a month" value={usd(data.monthly_cents)} />
            <Stat label="Backers" value={String(data.backers)} />
          </div>
        )}
        {testMode ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Stripe test mode: these backings charge no real card.
          </p>
        ) : null}
      </SectionCard>

      {data ? (
        <SectionCard title="Backings" subtitle="Every subscription for this place, newest first.">
          {data.backings.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">Nobody has made this place Premier yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground type-label">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Payer</th>
                    <th className="py-2 pr-4 font-medium">Tier</th>
                    <th className="py-2 pr-4 font-medium">Billing</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Paid through</th>
                  </tr>
                </thead>
                <tbody>
                  {data.backings.map((b) => (
                    <tr key={b.id} className="border-border border-t">
                      <td className="py-2 pr-4">{b.payer ?? "Deleted account"}</td>
                      <td className="py-2 pr-4">{BACKING_TIER_LABEL[b.tier] ?? b.tier}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {usd(b.amount_cents)}/{b.interval === "year" ? "yr" : "mo"}
                      </td>
                      <td className="py-2 pr-4 capitalize">{statusLabel(b)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{day(b.current_period_end)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
