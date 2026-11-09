"use client";

import { useState } from "react";
import { AlertTriangle, Pause, RotateCcw, Undo2, Store } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { Button, ChoicePill, SectionCard, Switch, TextField } from "@/components/admin-ui/config";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import {
  closeOutPlace,
  type Cursor,
  listNeedsReview,
  type MoneyConfig,
  type NeedsReviewRow,
  refundRow,
  reopenSettle,
  saveMoneyConfig,
} from "./actions";

// Manage › Money (MESITA-3307, W3). Four operator acts on guests' money:
//
//   Pause      app_config.money_config.buying_paused: every voucher sale
//              stops at once (the Vouchers tab reads paused, buy refuses).
//   Review     purchases and payments in needs_review, amount leading,
//              uncovered trailing, Stripe's error under them; a row the cron
//              gave up on (never paid) has Re-read, a paid one has Refund.
//   Refund     one purchase or payment by id, full or partial: card first
//              (Stripe, on the place's account), then a payment's credit part
//              back as credit.
//   Close out  every guest's unspent credit at one place back to their card.
//
// Every act is one tap and answers the server's verdict; nothing is guessed.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mxn(cents: number): string {
  return `MX$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "120.50" → 12050; blank → null (everything left); anything else → NaN. */
function centsFrom(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return Number.NaN;
  return Math.round(Number(t) * 100);
}

export function MoneyClient({
  initialConfig,
  initialRows,
  initialNext,
  loadError,
}: {
  initialConfig: MoneyConfig | null;
  initialRows: NeedsReviewRow[];
  initialNext: Cursor;
  loadError: string | null;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [rows, setRows] = useState(initialRows);
  const [next, setNext] = useState(initialNext);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError);
  const [notice, setNotice] = useState<string | null>(null);

  const [kind, setKind] = useState<NeedsReviewRow["kind"]>("payment");
  const [rowId, setRowId] = useState("");
  const [amount, setAmount] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  }

  async function flipPause() {
    if (!config) return;
    const r = await run("pause", () => saveMoneyConfig({ ...config, buying_paused: !config.buying_paused }));
    if (!r.ok) return setError(r.error);
    setConfig(r.config);
  }

  async function reload(more = false) {
    const r = await run("list", () => listNeedsReview(more ? next : null));
    if (!r.ok) return setError(r.error);
    setRows(more ? [...rows, ...r.rows] : r.rows);
    setNext(r.next);
  }

  async function reread(row: NeedsReviewRow) {
    const r = await run(`reread:${row.id}`, () => reopenSettle(row.kind, row.id));
    if (!r.ok) return setError(r.error);
    setRows(rows.filter((x) => x.id !== row.id));
    setNotice("Sent back to the settle cron: the next tick re-reads it from Stripe.");
  }

  async function refund(k: NeedsReviewRow["kind"], id: string, raw: string) {
    const cents = centsFrom(raw);
    if (!UUID.test(id.trim())) return setError("Paste the purchase or payment id.");
    if (Number.isNaN(cents)) return setError("Type the amount in pesos, like 120.50, or leave it blank for everything left.");
    const r = await run(`refund:${id}`, () => refundRow(k, id.trim(), cents));
    if (!r.ok) return setError(r.error);
    setNotice(
      `Refunded ${mxn(r.card_refunded_cents)} to the card` +
        (r.credit_refunded_cents ? ` and ${mxn(r.credit_refunded_cents)} back as credit` : "") +
        `. The row reads ${r.status ?? "updated"}.`,
    );
    setRowId("");
    setAmount("");
  }

  async function closeOut() {
    if (!UUID.test(placeId.trim())) return setError("Paste the place id.");
    if (!confirmClose) return setConfirmClose(true);
    setConfirmClose(false);
    const r = await run("close", () => closeOutPlace(placeId.trim()));
    if (!r.ok) return setError(r.error);
    const failed = r.refunds.filter((x) => !x.ok);
    setNotice(
      `Closed out: ${mxn(r.refunded_cents)} back to ${r.guests} ${r.guests === 1 ? "guest" : "guests"} in ${r.refunds.length - failed.length} refunds.` +
        (failed.length ? ` ${failed.length} refused: ${failed.map((f) => f.stripe_code ?? f.code).join(", ")}.` : ""),
    );
  }

  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Money" description="Guests' vouchers and payments: pause sales, review, refund, close out." />
      {error ? <ErrorNote message={error} /> : null}
      {notice ? <p className="text-muted-foreground text-sm">{notice}</p> : null}

      <SectionCard
        icon={<Pause className="h-4 w-4" />}
        title="Pause voucher sales"
        subtitle="While on, no guest can buy a voucher anywhere. Credit already bought still pays."
        state={
          config ? (
            <Switch
              on={config.buying_paused}
              pending={busy === "pause"}
              onClick={() => void flipPause()}
              label={`Pause voucher sales: ${config.buying_paused ? "on" : "off"}`}
            />
          ) : null
        }
      >
        {null}
      </SectionCard>

      <SectionCard
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Needs review"
        subtitle="Stripe never confirmed it (Re-read sends it back to the cron), or a refund took back more credit than the guest still held (uncovered)."
        state={
          <Button tone="secondary" size="sm" pending={busy === "list"} onClick={() => void reload()}>
            Refresh
          </Button>
        }
      >
        {rows.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">Nothing needs review.</p>
        ) : (
          <ul className="divide-border border-border mt-4 divide-y rounded-xl border">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="font-semibold tabular-nums">{mxn(row.amount_cents)}</span>
                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                  {row.place_name ?? row.place_id} · {row.kind}
                  {row.voucher ? ` · ${row.voucher}` : ""} · {when(row.created_at)}
                  {row.livemode ? " · live" : " · test"}
                  {row.stripe_error ? <span className="block">{row.stripe_error}</span> : null}
                  <span className="block font-mono text-xs">{row.id}</span>
                </span>
                {row.uncovered_cents > 0 ? (
                  <span className="text-destructive tabular-nums">{mxn(row.uncovered_cents)} uncovered</span>
                ) : null}
                {row.reopenable ? (
                  <Button size="sm" tone="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />} pending={busy === `reread:${row.id}`} onClick={() => void reread(row)}>
                    Re-read
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    tone="secondary"
                    icon={<Undo2 className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setKind(row.kind);
                      setRowId(row.id);
                    }}
                  >
                    Refund
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {next ? (
          <div className="mt-3">
            <Button tone="ghost" size="sm" pending={busy === "list"} onClick={() => void reload(true)}>
              Older
            </Button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        icon={<Undo2 className="h-4 w-4" />}
        title="Refund"
        subtitle="One voucher purchase or one payment. A payment's card part (with the tip) goes back to the card first, then its credit part comes back as credit at once. Blank amount: everything left."
      >
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <ChoicePill active={kind === "payment"} onClick={() => setKind("payment")}>Payment</ChoicePill>
            <ChoicePill active={kind === "purchase"} onClick={() => setKind("purchase")}>Voucher purchase</ChoicePill>
          </div>
          <TextField label="Id" value={rowId} onChange={setRowId} placeholder="00000000-0000-0000-0000-000000000000" spellCheck={false} />
          <TextField label="Amount (MX$)" value={amount} onChange={setAmount} placeholder="Everything left" />
          <div>
            <Button pending={busy?.startsWith("refund:") ?? false} onClick={() => void refund(kind, rowId, amount)}>
              Refund
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Store className="h-4 w-4" />}
        title="Close out a place"
        subtitle="Every guest's unspent credit at this place goes back to their card, newest voucher first. It cannot be undone."
      >
        <div className="mt-4 flex flex-col gap-3">
          <TextField label="Place id" value={placeId} onChange={(v) => { setPlaceId(v); setConfirmClose(false); }} spellCheck={false} />
          <div>
            <Button tone={confirmClose ? "danger" : "primary"} pending={busy === "close"} onClick={() => void closeOut()}>
              {confirmClose ? "Yes, refund every guest" : "Close out"}
            </Button>
          </div>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
