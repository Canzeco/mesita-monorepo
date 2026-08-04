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
  KeyRound,
  Loader2,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type CheckPayload,
  type EFResult,
  checkErrorMessage,
  fetchCheck,
  formatMxn,
  markPaid,
  submitBill,
} from "@/lib/check-api";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  open: { label: "Ticket abierto — descuento activo", tone: "bg-primary/10 text-primary" },
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
  // Staff PIN (MESITA-823) — only asked for when the place turned the gate
  // on. Held in component state for the session, so one entry covers the
  // whole visit (bill → verdict → paid) and the close stays two-tap.
  const [pin, setPin] = useState("");
  const [pinOpen, setPinOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetchCheck(code);
    if (res.ok && "check" in res) setCheck(res.check);
  }, [code]);

  const run = useCallback(
    async (key: string, fn: () => Promise<EFResult<unknown>>) => {
      setBusy(key);
      setError(null);
      const res = await fn();
      if (!res.ok) {
        // The place turned on a staff PIN (MESITA-823): surface the field
        // instead of a raw error, and keep the entered digits on a retry.
        if (res.code === "pin_required" || res.code === "pin_invalid") {
          setPinOpen(true);
          setError(checkErrorMessage(res));
          setBusy(null);
          return;
        }
        setError(checkErrorMessage(res));
        // A write that failed on the network or a rate limit changed
        // nothing server-side, and re-fetching would only replace the
        // message with a second failure. Stop here and let staff retry.
        if (res.status === 0 || res.status === 429) {
          setBusy(null);
          return;
        }
      }
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
    void run("bill", () => submitBill(code, Math.round(pesos * 100), pin));
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

        {/* v3b (MESITA-850): no bill yet — the ticket states the commitment
            outright. The place applies it at its own POS; entering the
            subtotal below is optional, internal control only. */}
        {!check.bill && check.offer && check.status === "open" ? (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-center">
            <p className="font-display text-3xl leading-none font-bold text-primary tabular-nums">
              {check.offer.discount_percent ?? 0}%
            </p>
            <p className="mt-1 text-sm font-semibold">de descuento para este cliente</p>
            {check.offer.reward_cap_mxn ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sobre los primeros MX${check.offer.reward_cap_mxn} de la cuenta —
                aplícalo en tu punto de venta.
              </p>
            ) : null}
          </div>
        ) : null}

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

        {/* Staff PIN — shown only when the place turned the gate on. One
            entry covers every action of this visit. */}
        {(check.pin_required || pinOpen) && !terminal ? (
          <div className="flex flex-col gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
            <label
              htmlFor="check-pin"
              className="flex items-center gap-2 text-xs font-semibold tracking-wide text-amber-800 uppercase"
            >
              <KeyRound className="size-3.5" /> PIN del personal
            </label>
            <input
              id="check-pin"
              inputMode="numeric"
              autoComplete="off"
              placeholder="······"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-11 w-36 rounded-md border border-input bg-background px-3 font-mono text-lg tracking-[0.3em] tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <p className="text-[11px] leading-snug text-amber-800/80">
              Este lugar pide un código de 6 dígitos para cobrar o cerrar el
              ticket. Pídeselo a tu gerente.
            </p>
          </div>
        ) : null}

        {/* Action: bill entry — OPTIONAL since v3b (MESITA-850). Internal
            control only, never a gate: skipping it and closing directly is
            equally valid. */}
        {check.status === "open" ? (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="check-subtotal"
              className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Subtotal de la cuenta (MXN) — opcional
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
                Calcular
              </Button>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Si la escribes, Mesita calcula el total a cobrar con el descuento.
              Si no, aplica el descuento en tu punto de venta y cierra el
              ticket directo.
            </p>
          </div>
        ) : null}

        {/* Lo que el cliente ya hizo — SOLO informativo (MESITA-849). El
            cliente completa sus tareas antes de que tú escanees; aquí no se
            aprueba ni se rechaza nada. */}
        {check.story.required && !terminal ? (
          <TaskRow
            icon={<Instagram className="size-4" />}
            title="Historia de Instagram"
            state={check.story.state}
            pendingHint="El cliente aún no la publicó."
          />
        ) : null}

        {check.review.required && !terminal ? (
          <TaskRow
            icon={<Star className="size-4" />}
            title="Reseña de Google"
            state={check.review.state}
            pendingHint="El cliente aún no la dejó."
          />
        ) : null}

        {/* Action: the single unconditional close (v3b, MESITA-850). Works
            with or without a bill on record — the bill is never a gate. */}
        {check.status === "awaiting_payment_confirm" || check.status === "open" ? (
          <Button
            size="lg"
            className="w-full"
            disabled={busy != null}
            onClick={() => void run("paid", () => markPaid(code, pin))}
          >
            {busy === "paid" ? <Loader2 className="animate-spin" /> : <Check />}
            {check.bill
              ? "Pago recibido — cerrar ticket"
              : "Descuento aplicado — cerrar ticket"}
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

// Read-only (MESITA-849). El personal ya no juzga las tareas del cliente: se
// completan antes del escaneo y el descuento ya viene calculado con ellas.
// Esta fila existe para que veas QUÉ hizo el cliente, no para decidirlo.
function TaskRow({
  icon,
  title,
  state,
  pendingHint,
}: {
  icon: React.ReactNode;
  title: string;
  state: string;
  pendingHint: string;
}) {
  const done = state === "approved";
  return (
    <div className="rounded-xl border border-border p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-secondary/10 text-secondary">
            {icon}
          </span>
          {title}
        </span>
        {done ? (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
            <Check className="size-3.5" /> Lista
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{pendingHint}</span>
        )}
      </div>
    </div>
  );
}
