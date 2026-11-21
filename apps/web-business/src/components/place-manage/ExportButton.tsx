"use client";

// Export (MESITA-4554, Pato: "add button to export excel always, but top
// right"): every Monitor list downloads as a CSV file Excel opens (UTF-8 with
// a BOM, so accents survive). It reads every page with the same filters the
// screen shows, up to 5,000 rows, through the same owner-only EFs.
import { useState } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { listCustomers, listMonitor, listPlaceViewsLog } from "@/lib/business-api";
import {
  creditLabel,
  customerLabel,
  linkLabel,
  rowAmount,
  rowDetail,
  rowStatus,
  shortId,
  type CustomerCursor,
  type MonitorCursor,
  type MonitorFilter,
  type MonitorKind,
} from "@/lib/monitor";
import { voucherName } from "@/lib/ticket-desk";
import { HeaderActions } from "@/components/shell/HeaderActions";

const MAX = 5000;

export type ExportKind = MonitorKind | "customers" | "views";

function csv(rows: string[][]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\n");
}

function pesos(cents: number): string {
  return (cents / 100).toFixed(2);
}

async function monitorRows(placeId: string, kind: MonitorKind, filter: MonitorFilter): Promise<string[][]> {
  const out: string[][] = [["ID", "Date", "Guest", "Customer", "Status", "Detail", "Amount", "Related"]];
  let before: MonitorCursor = null;
  do {
    const r = await listMonitor(placeId, kind, filter, before);
    if (!r.ok) throw new Error(r.error);
    for (const row of r.data.rows) {
      out.push([
        shortId(row.id),
        row.at,
        row.guest ?? "Deleted guest",
        row.customer ? customerLabel(row.customer) : "",
        kind === "credits" ? creditLabel(row) : kind === "vouchers" ? `${voucherName((row.payload.voucher as string | null) ?? null)} · ${rowStatus(kind, row)}` : rowStatus(kind, row),
        rowDetail(kind, row) ?? "",
        rowAmount(kind, row),
        row.links.map(linkLabel).join(" "),
      ]);
    }
    before = r.data.next;
  } while (before && out.length <= MAX);
  return out;
}

async function customerRows(placeId: string, customer: string | null): Promise<string[][]> {
  const out: string[][] = [["Customer", "Guest", "Owed (MXN)", "Last seen"]];
  let before: CustomerCursor = null;
  do {
    const r = await listCustomers(placeId, customer, before);
    if (!r.ok) throw new Error(r.error);
    for (const c of r.data.rows) out.push([customerLabel(c.customer), c.guest, pesos(c.owed_cents), c.last_seen]);
    before = r.data.next;
  } while (before && out.length <= MAX);
  return out;
}

async function viewRows(placeId: string, customer: string | null): Promise<string[][]> {
  const out: string[][] = [["Date", "Guest", "Customer", "Action", "Instagram"]];
  let before: string | null = null;
  do {
    const r = await listPlaceViewsLog(placeId, before ?? undefined, customer);
    if (!r.ok) throw new Error(r.error);
    for (const e of r.data.events) {
      out.push([e.at, e.person.name, e.customer ? customerLabel(e.customer) : "", e.kind === "saved" ? "liked" : e.kind, e.person.handle ? `@${e.person.handle}` : ""]);
    }
    before = r.data.next;
  } while (before && out.length <= MAX);
  return out;
}

export function ExportButton({
  placeId,
  kind,
  filter = {},
  name,
}: {
  placeId: string;
  kind: ExportKind;
  filter?: MonitorFilter;
  /** The file's name, e.g. "visits". */
  name: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
      <button
        type="button"
        className="bg-card border-border text-foreground hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const rows =
              kind === "customers"
                ? await customerRows(placeId, filter.id ?? null)
                : kind === "views"
                  ? await viewRows(placeId, filter.customer ?? null)
                  : await monitorRows(placeId, kind, filter);
            const blob = new Blob([csv(rows)], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `mesita-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Export failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <DownloadSimpleIcon size={14} weight="bold" aria-hidden />
        {busy ? "Exporting…" : "Export"}
      </button>
    </span>
  );
}

/** A Monitor page's actions, in the page header top right (MESITA-4555). */
export function MonitorToolbar({ children }: { children: React.ReactNode }) {
  return <HeaderActions>{children}</HeaderActions>;
}
