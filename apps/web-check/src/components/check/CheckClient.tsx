"use client";

// The live check card + the staff side of THE TICKET v4 (MESITA-1090/1092):
// scan → glance → approve, or send back ONE named fix. Two touches, near-zero
// effort — the restaurant never operates anything and never handles a refund.
//
// The verdict binds to the TICKET, never to a task (C1): story and review
// rows stay read-only status — the ticket-level "does this match the table in
// front of me" is the floor's whole job. No free-text rejection, exactly
// three fix chips, and the proof IMAGE never renders here (that is Ojo's job,
// MESITA-1034).
//
// LIVE: while a v4 ticket is on screen the page polls check-web-poll-ticket
// (audit-free — get-ticket logs an event per read and the limiter counts
// events per ip, so polling through it would rate-limit the waiter out of
// their own approve). visibilitychange + the Actualizar button are the
// primary refresh; the interval is a foreground garnish with backoff. When
// the last successful sync is stale, Aprobar DISABLES — staff must never
// approve numbers older than the poll.
//
// Every staff mutation carries expectedUpdatedAt (the CAS token). A 409
// stale_ticket means the guest changed something under the glance: the
// guest's write always wins, the screen re-renders, Aprobar re-enables.
//
// The GUEST enters the bill; staff never do. An unbilled ticket still scans,
// approves and closes — the discount is applied at the place's own POS.
//
// Privacy by construction: the payload only carries the blended final
// percent — no classes, no rungs.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  Flame,
  Instagram,
  KeyRound,
  Loader2,
  RefreshCw,
  Star,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type CheckFix,
  type CheckPayload,
  type CheckPollPayload,
  type EFResult,
  approveTicket,
  checkErrorMessage,
  fetchCheck,
  formatMxn,
  markPaid,
  pollTicket,
  requestFix,
  scanTicket,
  validateTicket,
} from "@/lib/check-api";
import { cn } from "@/lib/utils";

// Exhaustive over the statuses this page can meet — `tsc` catches a missing
// label the moment the vocabulary grows, instead of a Spanish-only surface
// printing a raw English enum on a floor.
type KnownStatus =
  | "open"
  | "scanned"
  | "approved"
  | "paying"
  | "awaiting_payment_confirm"
  | "revealed"
  | "cancelled";

function statusLabel(status: KnownStatus): { label: string; tone: string } {
  switch (status) {
    case "open":
      return {
        label: "Ticket abierto — descuento activo",
        tone: "bg-primary/10 text-primary",
      };
    case "scanned":
      return {
        label: "Escaneado — revisa y aprueba",
        tone: "bg-amber-500/10 text-amber-700",
      };
    case "approved":
      return {
        label: "Aprobado — esperando el pago",
        tone: "bg-emerald-500/15 text-emerald-700",
      };
    case "paying":
      return {
        label: "El cliente está pagando",
        tone: "bg-emerald-500/15 text-emerald-700",
      };
    case "awaiting_payment_confirm":
      return {
        label: "Listo para cobrar",
        tone: "bg-emerald-500/15 text-emerald-700",
      };
    case "revealed":
      return {
        label: "Pagado y cerrado",
        tone: "bg-emerald-500/15 text-emerald-700",
      };
    case "cancelled":
      return {
        label: "Cancelado",
        tone: "bg-destructive/10 text-destructive",
      };
  }
}

function statusFor(raw: string): { label: string; tone: string } {
  const known: KnownStatus[] = [
    "open",
    "scanned",
    "approved",
    "paying",
    "awaiting_payment_confirm",
    "revealed",
    "cancelled",
  ];
  return known.includes(raw as KnownStatus)
    ? statusLabel(raw as KnownStatus)
    : { label: "Estado desconocido", tone: "bg-muted text-muted-foreground" };
}

const FIX_LABEL: Record<CheckFix, string> = {
  bill: "Corregir la cuenta",
  proof: "Reenviar el comprobante",
  reward: "Revisar la recompensa",
};

function minutesAgo(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (mins < 1) return "hace un momento";
  if (mins === 1) return "hace 1 minuto";
  if (mins < 60) return `hace ${mins} minutos`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "hace 1 hora" : `hace ${hours} horas`;
}

// Poll cadence: foreground garnish only, with backoff on failure. The stale
// gate below keys on BASE_POLL_MS — approve never fires against data older
// than two intervals.
const BASE_POLL_MS = 3_000;
const MAX_POLL_MS = 30_000;
const STALE_AFTER_MS = BASE_POLL_MS * 2 + 1_000;

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
  // Staff PIN (MESITA-823) — one entry covers the whole visit.
  const [pin, setPin] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  // Stale gate state: recomputed inside async callbacks only (poll + the 2s
  // ticker below) — Date.now() never runs during render.
  const lastSyncedRef = useRef<number | null>(null);
  const [stale, setStale] = useState(false);

  // A ticket with a guest bill on record runs the v4 handshake. An unbilled
  // one has no numbers to freeze, so it skips straight to the close.
  const v4 = check.bill != null && check.updated_at != null;
  const terminal = check.status === "revealed" || check.status === "cancelled";

  const mergePoll = useCallback((poll: CheckPollPayload) => {
    setCheck((prev) => ({
      ...prev,
      status: poll.status,
      updated_at: poll.updated_at,
      fix_requested: poll.fix_requested,
      fix_note: poll.fix_note,
      approved_at: poll.approved_at,
      validated_at: poll.validated_at,
      paid_method: poll.paid_method,
      bill: poll.bill
        ? { ...(prev.bill ?? { reward_cap_mxn: null }), ...poll.bill }
        : prev.bill,
    }));
  }, []);

  const refresh = useCallback(async () => {
    // The poll is the cheap read; get-ticket stays for mutations' re-render.
    const res = await pollTicket(code);
    if (res.ok && "poll" in res) {
      mergePoll(res.poll);
      lastSyncedRef.current = Date.now();
      setStale(false);
      return true;
    }
    return false;
  }, [code, mergePoll]);

  const refreshFull = useCallback(async () => {
    const res = await fetchCheck(code);
    if (res.ok && "check" in res) {
      setCheck(res.check);
      lastSyncedRef.current = Date.now();
      setStale(false);
    }
  }, [code]);

  // v4: announce the scan ONCE (open → scanned is an affirmative staff
  // write, never a side effect of the read), then keep the screen live.
  const scannedRef = useRef(false);
  useEffect(() => {
    if (!v4 || terminal || scannedRef.current) return;
    scannedRef.current = true;
    void (async () => {
      await scanTicket(code, pin || undefined);
      await refresh();
    })();
    // The scan is per page-load; pin is read at fire time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v4, terminal, code]);

  useEffect(() => {
    if (!v4 || terminal) return;
    let cancelled = false;
    let delay = BASE_POLL_MS;
    let timer: number | undefined;
    const loop = async () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        const ok = await refresh();
        delay = ok ? BASE_POLL_MS : Math.min(delay * 2, MAX_POLL_MS);
      }
      if (!cancelled) timer = window.setTimeout(() => void loop(), delay);
    };
    timer = window.setTimeout(() => void loop(), delay);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [v4, terminal, refresh]);

  // The stale gate trips on its own clock, without needing a failed poll.
  useEffect(() => {
    if (!v4 || terminal) return;
    const t = window.setInterval(() => {
      const last = lastSyncedRef.current;
      setStale(last !== null && Date.now() - last > STALE_AFTER_MS);
    }, 2_000);
    return () => window.clearInterval(t);
  }, [v4, terminal]);

  const run = useCallback(
    async (key: string, fn: () => Promise<EFResult<unknown>>) => {
      setBusy(key);
      setError(null);
      const res = await fn();
      if (!res.ok) {
        if (res.code === "pin_required" || res.code === "pin_invalid") {
          setPinOpen(true);
          setError(checkErrorMessage(res));
          setBusy(null);
          return;
        }
        setError(checkErrorMessage(res));
        if (res.status === 0 || res.status === 429) {
          setBusy(null);
          return;
        }
      }
      await refreshFull();
      setBusy(null);
    },
    [refreshFull],
  );

  const status = statusFor(check.status);
  const scannedLine = minutesAgo(check.first_scanned_at);
  // MESITA-1095: the guest bill is always required. Under v4 a missing
  // bill blocks APPROVAL (MESITA-1148) — the button has to say so rather
  // than earn a 409 bill_required.
  const billMissing = !check.bill;
  const mustBillBeforeClose = billMissing && check.status === "open";

  const expected = check.updated_at ?? "";
  const fixOutstanding = Boolean(check.fix_requested);
  const canVerdict =
    v4 && check.status === "scanned" && !fixOutstanding && !stale &&
    !billMissing;

  const tipCents = check.bill?.tip_cents ?? 0;
  const subtotalCents = check.bill?.bill_subtotal_cents ?? 0;
  const discountCents = check.bill?.discount_cents ?? 0;
  // What the POS rings up vs. what the guest hands over (F3, staff side):
  // two labeled numbers, because the till splits them.
  const aCobrarCents = Math.max(0, subtotalCents - discountCents);

  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
      {/* Official header — the authenticity signal is the domain + brand. */}
      <div className="border-border bg-muted/40 flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <span className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg">
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
          <p className="text-muted-foreground mt-0.5 text-sm">
            {check.guest.instagram_handle
              ? `@${check.guest.instagram_handle} · `
              : ""}
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
            <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs">
              Primer escaneo {scannedLine}
            </span>
          ) : null}
        </div>

        {/* Stale banner (v4): never glance at frozen numbers. */}
        {stale ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5">
            <p className="text-[12.5px] leading-snug font-semibold text-amber-800">
              Pantalla desactualizada — actualiza antes de aprobar.
            </p>
            <Button size="sm" variant="outline" onClick={() => void refresh()}>
              <RefreshCw /> Actualizar
            </Button>
          </div>
        ) : null}

        {/* The numbers that matter — bill · tip · reward · proof at a
            glance (F3 staff side: A cobrar is what the POS rings up; the
            tip is the guest's real money on top, never discounted). */}
        {check.bill ? (
          <div className="border-border bg-muted/30 rounded-xl border p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-sm">Cuenta</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatMxn(subtotalCents)}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-muted-foreground text-sm">
                Descuento Mesita ({check.bill.discount_percent ?? 0}%)
              </span>
              <span className="text-sm font-semibold text-emerald-700 tabular-nums">
                −{formatMxn(discountCents)}
              </span>
            </div>
            <div className="border-border mt-2 flex items-baseline justify-between border-t pt-2">
              <span className="text-sm font-bold">A cobrar</span>
              <span className="font-display text-2xl font-bold tabular-nums">
                {formatMxn(aCobrarCents)}
              </span>
            </div>
            {tipCents > 0 ? (
              <>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-muted-foreground text-sm">
                    Propina
                    {check.bill.tip_pct != null
                      ? ` ${check.bill.tip_pct}% — sobre la cuenta completa`
                      : ""}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatMxn(tipCents)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground text-sm">
                    Total con propina
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {formatMxn(check.bill.amount_due_cents)}
                  </span>
                </div>
              </>
            ) : null}
            {check.bill.reward_cap_mxn ? (
              <p className="text-muted-foreground mt-1.5 text-[11px]">
                El descuento aplica sobre los primeros MX$
                {check.bill.reward_cap_mxn} de la cuenta.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Staff PIN — shown only when the place turned the gate on. */}
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
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="border-input bg-background focus-visible:ring-ring/50 h-11 w-36 rounded-md border px-3 font-mono text-lg tracking-[0.3em] tabular-nums outline-none focus-visible:ring-[3px]"
            />
            <p className="text-[11px] leading-snug text-amber-800/80">
              Este lugar pide un código de 6 dígitos para las acciones del
              ticket. Pídeselo a tu gerente.
            </p>
          </div>
        ) : null}

        {/* Lo que el cliente ya hizo — SOLO informativo (MESITA-849 · C1).
            El veredicto es del TICKET, nunca de una tarea. */}
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

        {/* v4 — corrección pendiente: named, amber, and it resolves LIVE off
            the poll the moment the guest sends the fix. */}
        {v4 && fixOutstanding ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
            <p className="text-[13px] font-bold text-amber-800">
              Corrección pedida:{" "}
              {FIX_LABEL[(check.fix_requested as CheckFix) ?? "bill"] ??
                check.fix_requested}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-amber-800/80">
              La pantalla del cliente ya lo muestra — aquí se actualiza en
              cuanto lo corrija. No hace falta un nuevo QR.
            </p>
          </div>
        ) : null}

        {/* v4 — THE VERDICT (C1): one Aprobar, one Pedir corrección with
            exactly three chips. Never a fourth, never free text. */}
        {v4 && check.status === "scanned" ? (
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              className="w-full"
              disabled={busy != null || !canVerdict}
              onClick={() =>
                void run("approve", () => approveTicket(code, expected, pin))
              }
            >
              {busy === "approve" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              Aprobar
            </Button>
            {billMissing ? (
              <p className="text-muted-foreground text-[11px] leading-snug">
                Este lugar requiere registrar la cuenta antes de aprobar. Pide
                la corrección de <span className="font-semibold">cuenta</span> y
                el cliente la captura.
              </p>
            ) : null}
            {!fixOutstanding ? (
              fixOpen ? (
                <div className="grid grid-cols-3 gap-2">
                  {(["bill", "proof", "reward"] as const).map((f) => (
                    <Button
                      key={f}
                      variant="outline"
                      size="sm"
                      disabled={busy != null || stale}
                      onClick={() => {
                        setFixOpen(false);
                        void run(`fix-${f}`, () =>
                          requestFix(code, f, expected, pin),
                        );
                      }}
                    >
                      {FIX_LABEL[f]}
                    </Button>
                  ))}
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy != null || stale}
                  onClick={() => setFixOpen(true)}
                >
                  <Undo2 /> Pedir corrección
                </Button>
              )
            ) : null}
          </div>
        ) : null}

        {/* v4 — payment confirmation: the restaurant's second touch. */}
        {v4 && (check.status === "approved" || check.status === "paying") ? (
          <div className="flex flex-col gap-1.5">
            <Button
              size="lg"
              className="w-full"
              disabled={busy != null}
              onClick={() =>
                void run("validate", () => validateTicket(code, pin))
              }
            >
              {busy === "validate" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              Pago recibido — cerrar ticket
            </Button>
            <p className="text-muted-foreground text-center text-[11px] leading-snug">
              {check.status === "paying"
                ? "El cliente eligió pagar en el lugar."
                : "El monto quedó congelado al aprobar."}
            </p>
          </div>
        ) : null}

        {/* Legacy close — unbilled v3 tickets and staff-billed ones. */}
        {!v4 &&
        (check.status === "awaiting_payment_confirm" ||
          check.status === "open") ? (
          <div className="flex flex-col gap-1.5">
            <Button
              size="lg"
              className="w-full"
              disabled={busy != null || mustBillBeforeClose}
              onClick={() => void run("paid", () => markPaid(code, pin))}
            >
              {busy === "paid" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              {check.bill
                ? "Pago recibido — cerrar ticket"
                : "Descuento aplicado — cerrar ticket"}
            </Button>
            {mustBillBeforeClose ? (
              <p className="text-muted-foreground text-center text-[11px] leading-snug">
                Este lugar requiere la cuenta registrada. El cliente la
                escribe en su ticket; pídesela para poder cerrar.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* awaiting_payment_confirm: the guest chose a rail and the place
            confirms the money arrived. */}
        {v4 && check.status === "awaiting_payment_confirm" ? (
          <Button
            size="lg"
            className="w-full"
            disabled={busy != null}
            onClick={() => void run("paid", () => markPaid(code, pin))}
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
          <p className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-center text-sm font-semibold">
            Este ticket fue cancelado.
          </p>
        ) : null}

        {error ? (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}

        {/* C2: scoped to THIS ticket — true today with cash at the register,
            still true the day a card path ships. */}
        <p className="text-muted-foreground text-center text-[11px] leading-snug">
          Página oficial de verificación de Mesita. El cliente te paga a ti,
          directamente. Mesita no cobra este ticket.
        </p>
      </div>
    </div>
  );
}

// Read-only (MESITA-849 · C1). El personal nunca juzga una TAREA: el
// veredicto de arriba es del ticket completo. Esta fila existe para que veas
// QUÉ hizo el cliente, no para decidirlo — y la imagen del comprobante nunca
// se muestra aquí (eso es de Ojo, MESITA-1034).
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
    <div className="border-border rounded-xl border p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="bg-secondary/10 text-secondary grid size-7 place-items-center rounded-lg">
            {icon}
          </span>
          {title}
        </span>
        {done ? (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
            <Check className="size-3.5" /> Lista
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">{pendingHint}</span>
        )}
      </div>
    </div>
  );
}
