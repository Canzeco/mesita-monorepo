"use client";

import Link from "next/link";
import { Fragment, useCallback, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, RefreshCw, Search, Zap } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { SectionCard } from "@/components/admin-ui/config";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { BoostSection } from "@/components/place-manage/sections/BoostSection";
import { placeTabHref } from "@/lib/place-tabs";
import { listPremier, type PremierList, type PremierRow } from "./actions";

// Manage › Premier (MESITA-3011). Every active place's paid visibility on
// one page, Premier places first: the level, who pays or who granted it,
// until when, how many pledges back it up, and what it charged in the last
// 30 days. A row opens that place's line in place (the same BoostSection as
// Single Place › Premier): grant a period nobody pays for, end a grant,
// remove a pledge. Stripe is the record of money; nothing here refunds.

const MARK: Record<number, string> = { 1: "2X", 2: "5X", 3: "10X" };

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "Paid · until Nov 28, 2026", "Granted · until …", "Charging…", or "Not Premier". */
export function standingLine(p: PremierRow): string {
  if (p.charging) return "Charging at Stripe…";
  if (p.period) return `${p.period.granted ? "Granted" : "Paid"} · until ${day(p.period.ends_at)}`;
  if (p.backups > 0) return "Not Premier · the next pledge is charged within 5 minutes";
  return "Not Premier";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground type-label">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  );
}

export function PremierClient({ initial, loadError }: { initial: PremierList | null; loadError: string | null }) {
  const [list, setList] = useState<PremierList | null>(initial);
  const [error, setError] = useState<string | null>(loadError);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await listPremier();
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setList(r.list);
  }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list?.places ?? [])
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          b.tier - a.tier ||
          b.backups + b.waiting - (a.backups + a.waiting) ||
          a.name.localeCompare(b.name),
      );
  }, [list, q]);

  return (
    <PageContainer size="5xl" className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        eyebrow="Manage · Premier"
        title="Premier"
        description="Paid visibility: ×2, ×5 or ×10 on the Map and Home. Guests pledge from a place's Premier tab; only the top pledge pays each period and the rest back it up. Grant a period here to make a place Premier without a payment."
      />

      <SectionCard
        icon={<Zap className="h-4 w-4" />}
        title="Overview"
        subtitle={
          list?.stripe === "live"
            ? "Stripe LIVE: pledges charge real cards."
            : list?.stripe === "test"
              ? "Stripe TEST: pay with card 4242 4242 4242 4242, any future date, any CVC. Nothing real is charged."
              : "Stripe is off: no key is set, so guests can't pledge. Grants still work."
        }
        state={
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            aria-label="Reload Premier"
            className="text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-50"
          >
            <RefreshCw className={"h-4 w-4" + (loading ? " animate-spin" : "")} />
          </button>
        }
      >
        {error && <ErrorNote message={error} />}
        {list && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Premier now" value={String(list.totals.premier_now)} />
            <Stat label="Granted" value={String(list.totals.granted_now)} />
            <Stat label="Pledges" value={String(list.totals.pledges)} />
            <Stat label="Charged · 30 days" value={usd(list.totals.charged_30d_cents)} />
          </div>
        )}
      </SectionCard>

      <section className="border-border bg-card flex flex-col rounded-2xl border">
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a place"
            aria-label="Find a place"
            className="min-h-9 w-full bg-transparent text-sm outline-none"
          />
        </div>
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">
            {list ? "No active place matches." : "Couldn't load the places."}
          </p>
        ) : (
          rows.map((p, i) => (
            <Fragment key={p.id}>
              {i > 0 && <div className="border-border border-t" />}
              <button
                type="button"
                onClick={() => setOpen(open === p.id ? null : p.id)}
                aria-expanded={open === p.id}
                className="hover:bg-muted/50 flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition"
              >
                <span
                  className={
                    "font-display w-12 shrink-0 text-lg leading-none font-semibold " +
                    (p.tier > 0 ? "" : "text-muted-foreground/40")
                  }
                >
                  {p.tier > 0 ? MARK[p.tier] : "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {standingLine(p)}
                    {p.backups > 0 && ` · ${p.backups} ${p.backups === 1 ? "backup" : "backups"}`}
                    {p.waiting > 0 && ` · ${p.waiting} waiting`}
                  </span>
                </span>
                {p.charged_30d_cents > 0 && (
                  <span className="text-sm font-semibold whitespace-nowrap">{usd(p.charged_30d_cents)}</span>
                )}
                <ChevronDown
                  className={"text-muted-foreground h-4 w-4 shrink-0 transition " + (open === p.id ? "rotate-180" : "")}
                  aria-hidden
                />
              </button>
              {open === p.id && (
                <div className="bg-muted/30 flex flex-col gap-3 px-4 pt-1 pb-4">
                  <Link
                    href={placeTabHref(p.id, "boost")}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start text-xs font-semibold"
                  >
                    Open in Single Place <ExternalLink className="h-3 w-3" aria-hidden />
                  </Link>
                  <BoostSection placeId={p.id} onChanged={() => void reload()} />
                </div>
              )}
            </Fragment>
          ))
        )}
      </section>
    </PageContainer>
  );
}
