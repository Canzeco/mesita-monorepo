"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Zap } from "lucide-react";
import {
  changePlaceBoost,
  getPlaceBoost,
  type AdminPeriod,
  type AdminPlaceBoost,
  type AdminPledge,
} from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";

// Single Place › Premier (MESITA-2995; Premier MESITA-2925, Boost
// MESITA-2789). The place's line — who pays now, who backs up, in the order
// a renewal walks them — and its recent periods with what each one charged,
// read from admin-web-get-place-premier. The operator can grant Manual
// Premier (MESITA-3091: Mesita's free lift, its own table, so a place can be
// Premier without a payment and a guest can still pay above it), end it, or
// take one pledge out of the line (admin-web-grant-place-premier). Nothing
// here refunds; Stripe is the record.

const TIER_LABEL: Record<number, string> = {
  0: "Not Premier",
  1: "Premier 2X",
  2: "Premier 5X",
};

// Two levels since MESITA-3041; a tier this build does not know reads "Premier".
const MARK: Record<number, string> = { 1: "2X", 2: "5X" };
const mark = (tier: number) => MARK[tier] ?? "Premier";

const PERIOD_STATUS: Record<AdminPeriod["status"], string> = {
  charging: "Charging",
  paid: "Paid",
  declined: "Declined",
  replaced: "Replaced",
  ended: "Ended",
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

function roleLabel(p: AdminPledge): string {
  if (p.role === "payer") return "Paying now";
  if (p.role === "backup") return `Backup ${p.position}`;
  if (p.status === "failed") return "Card declined";
  if (p.status === "open") return "Checkout open";
  return "Not in line";
}

/** A two-step button: the first tap arms it, the second does it. */
function ConfirmButton({
  label,
  confirm,
  busy,
  onConfirm,
}: {
  label: string;
  confirm: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      onBlur={() => setArmed(false)}
      className={
        "rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50 " +
        (armed ? "border-foreground bg-foreground text-white" : "border-border hover:bg-muted")
      }
    >
      {armed ? confirm : label}
    </button>
  );
}

export function BoostSection({
  placeId,
  onChanged,
}: {
  placeId: string;
  /** Manage › Premier re-reads its list after a write here (MESITA-3011). */
  onChanged?: () => void;
}) {
  const [data, setData] = useState<AdminPlaceBoost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [grantTier, setGrantTier] = useState<1 | 2>(1);
  const [grantMonths, setGrantMonths] = useState(1);

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

  async function change(c: Parameters<typeof changePlaceBoost>[1]) {
    setBusy(true);
    setActionError(null);
    const r = await changePlaceBoost(placeId, c);
    setBusy(false);
    if (!r.ok) {
      setActionError(r.error);
      return;
    }
    await load();
    onChanged?.();
  }

  const testMode = data?.line.some((p) => !p.livemode) ?? false;
  const manual = data?.manual ?? null;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={<Zap className="h-4 w-4" />}
        tint="amber"
        title="Premier"
        subtitle="Manual Premier is Mesita's free lift; Paid is what guests pay. The place's level is the higher of the two."
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
          <div className="mt-3 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Tier" value={TIER_LABEL[data.tier]} />
              <Stat label="Map factor" value={`×${data.factor}`} />
              <Stat
                label="Manual"
                value={manual ? `${mark(manual.tier)} · until ${day(manual.ends_at)}` : "—"}
              />
              <Stat
                label="Paid"
                value={data.period ? `${mark(data.period.tier)} · through ${day(data.period.ends_at)}` : "—"}
              />
            </div>

            {data.stuck > 0 ? (
              <p className="border-border rounded-lg border px-3 py-2 text-sm">
                {data.stuck} {data.stuck === 1 ? "charge has" : "charges have"} been waiting on Stripe for over two
                hours. The 5-minute sync keeps asking; past 24 hours it cancels and moves to the next pledge.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {manual ? (
                <ConfirmButton
                  label="End Manual Premier"
                  confirm="End it now"
                  busy={busy}
                  onConfirm={() => void change({ action: "end" })}
                />
              ) : (
                <>
                  <select
                    aria-label="Manual Premier level"
                    value={grantTier}
                    onChange={(e) => setGrantTier(Number(e.target.value) as 1 | 2)}
                    className="border-border bg-card rounded-full border px-3 py-1 text-xs"
                  >
                    <option value={1}>Premier 2X</option>
                    <option value={2}>Premier 5X</option>
                  </select>
                  <select
                    aria-label="Manual Premier length"
                    value={grantMonths}
                    onChange={(e) => setGrantMonths(Number(e.target.value))}
                    className="border-border bg-card rounded-full border px-3 py-1 text-xs"
                  >
                    {[1, 2, 3, 6, 12].map((m) => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? "month" : "months"}
                      </option>
                    ))}
                  </select>
                  <ConfirmButton
                    label="Grant Manual Premier"
                    confirm="Grant, no charge"
                    busy={busy}
                    onConfirm={() => void change({ action: "grant", tier: grantTier, months: grantMonths })}
                  />
                  {data.period ? (
                    <span className="text-muted-foreground text-xs">
                      A guest pays for {mark(data.period.tier)}; Manual never charges or ends it, and a renewal waits
                      while Manual covers its level.
                    </span>
                  ) : null}
                </>
              )}
            </div>
            {actionError ? (
              <p role="alert" className="text-destructive text-sm">
                {actionError}
              </p>
            ) : null}
          </div>
        )}
        {testMode ? (
          <p className="text-muted-foreground mt-3 text-xs">Stripe test mode: these pledges charge no real card.</p>
        ) : null}
      </SectionCard>

      {data ? (
        <SectionCard title="Line" subtitle="Who pays now, then who pays if that card fails, in order.">
          {data.line.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">Nobody has pledged for this place yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground type-label">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 pr-4 font-medium">Guest</th>
                    <th className="py-2 pr-4 font-medium">Level</th>
                    <th className="py-2 pr-4 font-medium">Billing</th>
                    <th className="py-2 pr-4 font-medium">In line since</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {data.line.map((p) => (
                    <tr key={p.id} className="border-border border-t">
                      <td className="py-2 pr-4 font-semibold whitespace-nowrap">{roleLabel(p)}</td>
                      <td className="py-2 pr-4">{p.payer ?? "Deleted account"}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {mark(p.tier)}
                        {p.pending_tier ? ` → ${mark(p.pending_tier)} (paying)` : ""}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {usd(p.amount_cents)}/{p.interval === "year" ? "yr" : "mo"}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{day(p.queued_at)}</td>
                      <td className="py-2 text-right">
                        <ConfirmButton
                          label="Remove"
                          confirm="Remove pledge"
                          busy={busy}
                          onConfirm={() => void change({ action: "remove_pledge", backingId: p.id })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}

      {data ? (
        <SectionCard title="Manual Premier" subtitle="Mesita's free lifts, newest first. Nothing is charged.">
          {(data.manual_history ?? []).length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">No Manual Premier yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground type-label">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Dates</th>
                    <th className="py-2 pr-4 font-medium">Level</th>
                    <th className="py-2 font-medium">Granted by</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.manual_history ?? []).map((m) => (
                    <tr key={m.id} className="border-border border-t">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {day(m.starts_at)} – {day(m.ends_at)}
                      </td>
                      <td className="py-2 pr-4">{mark(m.tier)}</td>
                      <td className="py-2">{m.source === "code" ? "A Mesita code" : (m.granted_by ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}

      {data ? (
        <SectionCard title="Paid periods" subtitle="What each paid stretch charged, newest first.">
          {data.periods.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">No paid period yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground type-label">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Dates</th>
                    <th className="py-2 pr-4 font-medium">Level</th>
                    <th className="py-2 pr-4 font-medium">Paid by</th>
                    <th className="py-2 pr-4 font-medium">Price</th>
                    <th className="py-2 pr-4 font-medium">Credit</th>
                    <th className="py-2 font-medium">Charged</th>
                  </tr>
                </thead>
                <tbody>
                  {data.periods.map((p) => (
                    <tr
                      key={p.id}
                      className={
                        "border-border border-t" + (p.status === "replaced" || p.status === "declined" ? " opacity-60" : "")
                      }
                    >
                      <td className="py-2 pr-4 whitespace-nowrap">{PERIOD_STATUS[p.status]}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {day(p.starts_at)} – {day(p.ends_at)}
                      </td>
                      <td className="py-2 pr-4">{mark(p.tier)}</td>
                      <td className="py-2 pr-4">{p.payer ?? "—"}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{usd(p.price_cents)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {p.credit_cents ? usd(p.credit_cents) : "—"}
                        {p.extra_days ? ` +${p.extra_days}d` : ""}
                      </td>
                      <td className="py-2 whitespace-nowrap">{usd(p.charged_cents)}</td>
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
