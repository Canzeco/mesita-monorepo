"use client";

import { useState, useTransition } from "react";
import { Landmark, RefreshCw } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { Button } from "@/components/admin-ui/config";
import {
  ConfirmDialog,
  GroupLabel,
  SectionCard,
  SelectField,
  TextArea,
  TextField,
} from "@/components/admin-ui/manage";
import { getCreditLiability, reverseCreditLot } from "./actions";
import type { CreditLiability } from "./types";

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(cents / 100);
}

function Table({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No rows yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-border/60 border-b text-left">
            {columns.map((c) => (
              <th
                key={c}
                className="text-muted-foreground py-2 pr-4 type-label font-semibold tracking-[0.08em] uppercase"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-border/40 border-b last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type FormState = {
  kind: "refund" | "adjust";
  lotId: string;
  organizationId: string;
  consumerId: string;
  amountCents: string;
  reason: string;
};

const EMPTY_FORM: FormState = {
  kind: "adjust",
  lotId: "",
  organizationId: "",
  consumerId: "",
  amountCents: "",
  reason: "",
};

export function CreditLiabilityClient({
  initialLiability,
  loadError,
}: {
  initialLiability: CreditLiability | null;
  loadError: string | null;
}) {
  const [liability, setLiability] = useState(initialLiability);
  const [error, setError] = useState(loadError);
  const [refreshing, startRefresh] = useTransition();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  function refresh() {
    startRefresh(async () => {
      const r = await getCreditLiability();
      if (r.ok) {
        setLiability(r.liability);
        setError(null);
      } else {
        setError(r.error);
      }
    });
  }

  const sweepMode = form.kind === "adjust" && !form.lotId.trim();
  const canSubmit =
    form.reason.trim().length >= 3 &&
    (form.lotId.trim().length > 0 ||
      (sweepMode && form.organizationId.trim() && form.consumerId.trim()));

  function submit() {
    setActionError(null);
    setActionResult(null);
    startSubmit(async () => {
      const amountCents = form.amountCents.trim()
        ? Number(form.amountCents.trim())
        : undefined;
      const r = await reverseCreditLot({
        kind: form.kind,
        reason: form.reason.trim(),
        lotId: form.lotId.trim() || undefined,
        organizationId: sweepMode ? form.organizationId.trim() : undefined,
        consumerId: sweepMode ? form.consumerId.trim() : undefined,
        amountCents,
      });
      setConfirmOpen(false);
      if (!r.ok) {
        setActionError(r.error);
        return;
      }
      setActionResult(JSON.stringify(r.data, null, 2));
      setForm(EMPTY_FORM);
      refresh();
    });
  }

  const disposition = liability?.expiryDisposition ?? null;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={<Landmark className="text-muted-foreground h-4 w-4" />}
        title="Issued, outstanding & breakage"
        subtitle="Grouped by currency — never summed across it. Pending = still inside its hold window. Breakage = permanently forfeited via the expiry sweep."
        action={
          <Button
            tone="secondary"
            size="sm"
            pending={refreshing}
            onClick={refresh}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        }
      >
        {error ? <ErrorNote message={error} /> : null}

        <div className="mt-4">
          <Table
            columns={["Currency", "Issued", "Outstanding", "Pending", "Breakage", "Lots"]}
            rows={(liability?.byCurrency ?? []).map((r) => [
              r.currency,
              money(r.issuedCents, r.currency),
              money(r.outstandingCents, r.currency),
              r.pendingCents == null
                ? "—"
                : `${money(r.pendingCents, r.currency)} (${r.pendingLotCount})`,
              money(r.breakageCents, r.currency),
              String(r.lotCount),
            ])}
          />
        </div>

        <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
          Expiry sweep disposition:{" "}
          {disposition ? (
            <span className="text-foreground font-medium">{disposition}</span>
          ) : (
            <span className="font-medium">
              not configured — the forfeit-vs-return question is open
              (MESITA-1679, MESITA-1680, MESITA-1678). The hourly sweep is
              running but refuses to touch any lot until this is set.
            </span>
          )}
        </p>
      </SectionCard>

      <SectionCard
        icon={<Landmark className="text-muted-foreground h-4 w-4" />}
        title="Per-organization exposure"
        subtitle="A currency mismatch means a lot's own currency disagrees with its organization's — a data-integrity signal, not a normal state."
      >
        <div className="mt-4">
          <Table
            columns={["Organization", "Currency", "Issued", "Outstanding", "Lots", ""]}
            rows={(liability?.byOrganization ?? []).map((r) => [
              r.organizationName,
              r.currency,
              money(r.issuedCents, r.currency),
              money(r.outstandingCents, r.currency),
              String(r.lotCount),
              r.currencyMismatch ? (
                <span
                  key="mismatch"
                  className="border-destructive/30 bg-destructive/5 text-destructive inline-flex items-center rounded-full border px-2 py-0.5 type-meta font-semibold"
                >
                  currency mismatch
                </span>
              ) : (
                ""
              ),
            ])}
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<Landmark className="text-muted-foreground h-4 w-4" />}
        title="Refund, cancel & adjust"
        subtitle="refund calls Stripe and returns real money — the balance updates once the webhook confirms, not immediately. adjust claws back a lot (or every live lot a guest holds at one organization, when Lot ID is left blank) with no Stripe leg — an org closing, or correcting an error."
      >
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Kind"
            value={form.kind}
            onChange={(v) => setForm((f) => ({ ...f, kind: v as FormState["kind"] }))}
            options={[
              { value: "adjust", label: "adjust — no Stripe leg" },
              { value: "refund", label: "refund — real Stripe refund" },
            ]}
          />
          <TextField
            label="Lot ID"
            value={form.lotId}
            onChange={(v) => setForm((f) => ({ ...f, lotId: v }))}
            placeholder="required for refund; leave blank for an adjust sweep"
          />
          {sweepMode ? (
            <>
              <TextField
                label="Organization ID (sweep)"
                value={form.organizationId}
                onChange={(v) => setForm((f) => ({ ...f, organizationId: v }))}
              />
              <TextField
                label="Consumer ID (sweep)"
                value={form.consumerId}
                onChange={(v) => setForm((f) => ({ ...f, consumerId: v }))}
              />
            </>
          ) : null}
          <TextField
            label="Amount (cents, optional)"
            value={form.amountCents}
            onChange={(v) => setForm((f) => ({ ...f, amountCents: v.replace(/[^0-9]/g, "") }))}
            placeholder="blank = full remaining balance"
          />
        </div>
        <div className="mt-4">
          <GroupLabel>Reason (required — this is money)</GroupLabel>
          <div className="mt-1.5">
            <TextArea
              label=""
              value={form.reason}
              onChange={(v) => setForm((f) => ({ ...f, reason: v }))}
              rows={2}
              placeholder="e.g. guest disputed top-up pi_..., org closed 2026-09-08"
            />
          </div>
        </div>

        <div className="border-border/60 mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <span className="text-xs">
            {sweepMode ? (
              <span className="text-muted-foreground">
                Sweep mode: claws back every live lot this guest holds at this
                organization.
              </span>
            ) : null}
          </span>
          <Button
            tone={form.kind === "refund" ? "danger" : "primary"}
            disabled={!canSubmit}
            pending={submitting}
            onClick={() => setConfirmOpen(true)}
          >
            {form.kind === "refund" ? "Refund via Stripe" : "Adjust"}
          </Button>
        </div>

        {actionError ? <ErrorNote message={actionError} /> : null}
        {actionResult ? (
          <pre className="border-border/60 bg-muted/40 mt-4 overflow-x-auto rounded-xl border p-3 text-xs">
            {actionResult}
          </pre>
        ) : null}
      </SectionCard>

      <ConfirmDialog
        open={confirmOpen}
        title={form.kind === "refund" ? "Refund via Stripe?" : "Claw back Credits?"}
        body={
          form.kind === "refund"
            ? "This calls Stripe now and returns real money. It cannot be undone from here."
            : sweepMode
              ? "This claws back every live lot this guest holds at this organization. It cannot be undone from here."
              : "This claws back the lot with no Stripe leg. It cannot be undone from here."
        }
        confirmLabel={form.kind === "refund" ? "Refund" : "Adjust"}
        danger
        busy={submitting}
        onConfirm={submit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
