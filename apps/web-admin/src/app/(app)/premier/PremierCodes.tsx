"use client";

import { useState } from "react";
import { Copy, Ticket } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { SectionCard } from "@/components/admin-ui/config";
import {
  createPremierCode,
  revokePremierCode,
  type PremierCode,
} from "./actions";

// Premier codes (MESITA-3167). A code is 100%: whoever redeems it on a place
// (a guest on the place's Premier tab, or its owner or editor on Business ›
// Billing) gets its Refill days at its tier. Mint shows the plain code ONCE;
// the database keeps only its HMAC and last 4. Revoke ends a code now, and
// the days places already redeemed keep running.

const MARK: Record<number, string> = { 1: "2X", 2: "5X" };

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

/** "Active", "Used up", "Expired Dec 1, 2026" or "Revoked Nov 3, 2026". */
export function codeState(c: PremierCode, now: number): string {
  if (c.revoked_at) return `Revoked ${day(c.revoked_at)}`;
  if (c.expires_at && Date.parse(c.expires_at) <= now)
    return `Expired ${day(c.expires_at)}`;
  if (c.redeemed >= c.max_redemptions) return "Used up";
  return c.expires_at ? `Active until ${day(c.expires_at)}` : "Active";
}

const FIELD =
  "border-border bg-background min-h-10 rounded-lg border px-3 text-sm";

export function PremierCodes({
  codes,
  onChanged,
}: {
  codes: PremierCode[];
  onChanged: () => void;
}) {
  const [tier, setTier] = useState<1 | 2>(1);
  const [days, setDays] = useState("30");
  const [uses, setUses] = useState("1");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<{
    code: string;
    tier: 1 | 2;
    days: number;
  } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  // The page's clock for "expired" (a render must not read the time).
  const [now] = useState(() => Date.now());

  async function mint() {
    setBusy(true);
    setError(null);
    setMinted(null);
    const d = Number(days);
    // A date input is a calendar day: the code works through the end of it (UTC).
    const r = await createPremierCode({
      tier,
      days: d,
      maxRedemptions: Number(uses),
      expiresAt: expires ? `${expires}T23:59:59Z` : null,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setMinted({ code: r.code, tier, days: d });
    onChanged();
  }

  async function revoke(c: PremierCode) {
    if (
      !window.confirm(
        `Revoke code ••${c.last4}? Days places already redeemed keep running.`,
      )
    )
      return;
    setRevoking(c.id);
    setError(null);
    const r = await revokePremierCode(c.id);
    setRevoking(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onChanged();
  }

  return (
    <SectionCard
      icon={<Ticket className="h-4 w-4" />}
      title="Codes"
      subtitle="A code gives a place a free Boost: Premier 2X or 5X, for a number of days. It never takes a percentage off. Each place redeems a code once."
    >
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground type-label">Tier</span>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value === "2" ? 2 : 1)}
              className={FIELD}
            >
              <option value={1}>2X</option>
              <option value={2}>5X</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground type-label">Days</span>
            <input
              type="number"
              min={1}
              max={366}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={FIELD + " w-24"}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground type-label">Uses</span>
            <input
              type="number"
              min={1}
              max={100000}
              value={uses}
              onChange={(e) => setUses(e.target.value)}
              className={FIELD + " w-24"}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground type-label">
              Expires (optional)
            </span>
            <input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className={FIELD}
            />
          </label>
          <button
            type="button"
            onClick={() => void mint()}
            disabled={busy}
            className="bg-foreground text-background min-h-10 rounded-lg px-4 text-sm font-semibold transition disabled:opacity-50"
          >
            {busy ? "Minting…" : "Mint code"}
          </button>
        </div>

        {minted && (
          <div
            className="border-border bg-muted/40 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
            aria-live="polite"
          >
            <span className="font-mono text-lg font-semibold tracking-widest">
              {minted.code}
            </span>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(minted.code)}
              aria-label="Copy the code"
              className="text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-full"
            >
              <Copy className="h-4 w-4" />
            </button>
            <span className="text-muted-foreground text-sm">
              {MARK[minted.tier]} for {minted.days} days. Copy it now: it is not
              shown again.
            </span>
          </div>
        )}

        {error && <ErrorNote message={error} />}

        {codes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No codes yet.</p>
        ) : (
          <div className="border-border flex flex-col rounded-xl border">
            {codes.map((c, i) => {
              const live =
                !c.revoked_at &&
                !(c.expires_at && Date.parse(c.expires_at) <= now);
              return (
                <div
                  key={c.id}
                  className={
                    "flex min-h-12 flex-wrap items-center gap-3 px-4 py-2 " +
                    (i > 0 ? "border-border border-t" : "")
                  }
                >
                  <span className="font-mono text-sm font-semibold">
                    ••{c.last4}
                  </span>
                  <span className="text-sm font-semibold">
                    {MARK[c.tier] ?? "Premier"}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {c.days} days
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {c.redeemed} / {c.max_redemptions} used
                  </span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                    {codeState(c, now)} · by {c.created_by} ·{" "}
                    {day(c.created_at)}
                  </span>
                  {live && (
                    <button
                      type="button"
                      onClick={() => void revoke(c)}
                      disabled={revoking === c.id}
                      className="text-sm font-semibold underline underline-offset-4 disabled:opacity-50"
                    >
                      {revoking === c.id ? "Revoking…" : "Revoke"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
