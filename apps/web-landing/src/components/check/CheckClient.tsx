"use client";

// The live check card + the three staff actions (bill · story/review
// verdicts · paid received). One client component: takes the RSC-fetched
// initial payload, re-fetches after every mutation so the card always shows
// the server's truth, never an optimistic guess.
//
// Privacy note honored by construction: the payload only ever carries the
// blended final percent — this component has no concept of classes or rungs.

import { useCallback, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  Check,
  Flame,
  Instagram,
  Loader2,
  Star,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type CheckPayload,
  fetchCheck,
  formatMxn,
  markPaid,
  submitBill,
  verifyAction,
} from "@/lib/check-api";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  open: { label: "Ticket abierto — falta la cuenta", tone: "bg-primary/10 text-primary" },
  awaiting_story: {
    label: "Esperando historia de Instagram",
    tone: "bg-amber-500/15 text-amber-700",
  },
  awaiting_payment_confirm: {
    label: "Listo para cobrar",
    tone: "bg-emerald-500/15 text-emerald-700",
  },
  revealed: { label: "Pagado y cerrado", tone: "bg-emerald-500/15 text-emerald-700" },
  cancelled: { label: "Cancelado", tone: "bg-destructive/10 text-destructive" },
};

function minutesAgo(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "hace un momento";
  if (mins === 1) return "hace 1 minuto";
  if (mins < 60) return `hace ${mins} minutos`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "hace 1 hora" : `hace ${hours} horas`;
}

export function CheckClient({
  code,
  initial,
}: {
  code: string;
  initial: CheckPayload;
}) {
  const [check, setCheck] = useState<CheckPayload>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subtotal, setSubtotal] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetchCheck(code);
    if (res.ok && "check" in res) setCheck(res.check);
  }, [code]);

  const run = useCallback(
    async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
      setBusy(key);
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Algo salió mal — intenta de nuevo.");
      await refresh();
      setBusy(null);
    },
    [refresh],
  );

  const status = STATUS_LABEL[check.status] ?? {
    label: check.status,
    tone: "bg-muted text-muted-foreground",
  };
  const scannedLine = minutesAgo(check.first_scanned_at);
  const terminal = check.status === "revealed" || check.status === "cancelled";

  const onSubmitBill = () => {
    const pesos = Number(subtotal.replace(/[,$\s]/g, ""));
    if (!Number.isFinite(pesos) || pesos <= 0) {
      setError("Escribe el subtotal de la cuenta en pesos.");
      return;
    }
    void run("bill", () => submitBill(code, Math.round(pesos * 100)));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Official header — the authenticity signal is the domain + brand. */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3.5">
        <span className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Flame className="size-4 fill-current" />
          </span>
          Check Mesita
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <BadgeCheck className="size-4" /> Verificado
        </span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {/* Guest + place — the face-match line. */}
        <div>
          <p className="text-lg leading-tight font-bold tracking-tight">
            {check.guest.display_name}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {check.guest.instagram_handle ? `@${check.guest.instagram_handle} · ` : ""}
            en {check.place.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              status.tone,
            )}
          >
            {status.label}
          </span>
          {scannedLine ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              Primer escaneo {scannedLine}
            </span>
          ) : null}
        </div>

        {/* The number that matters. */}
        {check.bill ? (
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Cuenta</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatMxn(check.bill.check_subtotal_cents)}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                Descuento Mesita ({check.bill.discount_percent ?? 0}%)
              </span>
              <span className="text-sm font-semibold text-emerald-700 tabular-nums">
                −{formatMxn(check.bill.discount_cents)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-sm font-bold">A cobrar</span>
              <span className="font-display text-2xl font-bold tabular-nums">
                {formatMxn(check.bill.amount_due_cents)}
              </span>
            </div>
            {check.bill.reward_cap_mxn ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                El descuento aplica sobre los primeros MX${check.bill.reward_cap_mxn}
                {" "}de la cuenta.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Action: bill entry (only while open). */}
        {check.status === "open" ? (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="check-subtotal"
              className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Subtotal de la cuenta (MXN)
            </label>
            <div className="flex gap-2">
              <input
                id="check-subtotal"
                inputMode="decimal"
                placeholder="850"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <Button onClick={onSubmitBill} disabled={busy != null}>
                {busy === "bill" ? <Loader2 className="animate-spin" /> : <Banknote />}
                Aplicar descuento
              </Button>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Escribe el subtotal y Mesita te regresa el total a cobrar con el
              descuento aplicado.
            </p>
          </div>
        ) : null}

        {/* Action: story verdict. */}
        {check.story.required && !terminal ? (
          <ActionRow
            icon={<Instagram className="size-4" />}
            title="Historia de Instagram"
            state={check.story.state}
            screenshotUrl={check.story.screenshot_url}
            pendingHint="El cliente aún no envía su historia."
            busy={busy === "story"}
            disabled={busy != null}
            onDecide={(d) => void run("story", () => verifyAction(code, "story", d))}
          />
        ) : null}

        {/* Action: review verdict. */}
        {check.review.required && !terminal ? (
          <ActionRow
            icon={<Star className="size-4" />}
            title="Reseña de Google"
            state={check.review.state}
            screenshotUrl={null}
            pendingHint="El cliente aún no envía su reseña."
            busy={busy === "review"}
            disabled={busy != null}
            onDecide={(d) => void run("review", () => verifyAction(code, "review", d))}
          />
        ) : null}

        {/* Action: paid received. */}
        {check.status === "awaiting_payment_confirm" ? (
          <Button
            size="lg"
            className="w-full"
            disabled={busy != null}
            onClick={() => void run("paid", () => markPaid(code))}
          >
            {busy === "paid" ? <Loader2 className="animate-spin" /> : <Check />}
            Pago recibido — cerrar ticket
          </Button>
        ) : null}

        {check.status === "revealed" ? (
          <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-center text-sm font-semibold text-emerald-700">
            Ticket cerrado. ¡Gracias!
          </p>
        ) : null}
        {check.status === "cancelled" ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm font-semibold text-destructive">
            Este ticket fue cancelado.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <p className="text-center text-[11px] leading-snug text-muted-foreground">
          Página oficial de verificación de Mesita. El cliente paga
          directamente al lugar — Mesita nunca toca el dinero.
        </p>
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  title,
  state,
  screenshotUrl,
  pendingHint,
  busy,
  disabled,
  onDecide,
}: {
  icon: React.ReactNode;
  title: string;
  state: string;
  screenshotUrl: string | null;
  pendingHint: string;
  busy: boolean;
  disabled: boolean;
  onDecide: (decision: "approve" | "reject") => void;
}) {
  return (
    <div className="rounded-xl border border-border p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-secondary/10 text-secondary">
            {icon}
          </span>
          {title}
        </span>
        {state === "approved" ? (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
            <Check className="size-3.5" /> Aprobada
          </span>
        ) : state === "pending" || state === "none" ? (
          <span className="text-xs text-muted-foreground">{pendingHint}</span>
        ) : null}
      </div>
      {(state === "submitted" || state === "rejected") && (
        <div className="mt-3 flex flex-col gap-2.5">
          {screenshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, unoptimizable screenshot
            <img
              src={screenshotUrl}
              alt="Captura enviada por el cliente"
              className="max-h-56 w-full rounded-lg border border-border object-contain"
            />
          ) : null}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={disabled}
              onClick={() => onDecide("approve")}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Check />}
              Aprobar
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={disabled}
              onClick={() => onDecide("reject")}
            >
              <X /> Rechazar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
