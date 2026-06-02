"use client";

import { useState } from "react";
import { Loader2, ReceiptText, RefreshCw, XCircle } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiCancelTicket,
  apiCreateTicket,
  apiListTickets,
  apiMarkTicketPaid,
  type BusinessTicket,
} from "@/lib/api/tickets";
import { cn, errMsg } from "@/lib/utils";
import {
  ERROR_BOX_CLASS,
  INFO_BOX_CLASS,
  PILL_BUTTON_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { EmptyState, Section } from "@/components/shared";

type ScanTicketType = "A" | "B" | "C" | "D";

const TICKET_KIND_BY_TYPE: Record<ScanTicketType, string> = {
  A: "dp",
  B: "s_dp_sf",
  C: "p_c",
  D: "s_p_sf_c",
};

function centsToMoney(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "MXN",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function statusTone(status: BusinessTicket["status"]): string {
  if (status === "pending_pay" || status === "awaiting_payment_confirm") {
    return "bg-amber-500/10 text-amber-700";
  }
  if (status === "paid" || status === "revealed") {
    return "bg-emerald-500/10 text-emerald-700";
  }
  if (status === "awaiting_story") {
    return "bg-violet-500/10 text-violet-700";
  }
  if (status === "cancelled") {
    return "bg-muted text-muted-foreground";
  }
  return "bg-secondary/10 text-secondary";
}

type LifecycleStep = {
  key: "created" | "awaiting_payment_confirm" | "paid" | "awaiting_story" | "revealed";
  label: string;
  state: "done" | "active" | "upcoming";
};

function lifecycleFor(ticket: BusinessTicket): LifecycleStep[] {
  const cancelled = ticket.status === "cancelled";
  const done = (v: boolean): LifecycleStep["state"] => (v ? "done" : "upcoming");

  if (cancelled) {
    return [
      { key: "created", label: "Created", state: "done" },
      {
        key: "awaiting_payment_confirm",
        label: "Payment",
        state: "active",
      },
      { key: "paid", label: "Paid", state: "upcoming" },
      { key: "awaiting_story", label: "Story", state: "upcoming" },
      { key: "revealed", label: "Revealed", state: "upcoming" },
    ];
  }

  const createdDone = true;
  const paymentPromptDone =
    ticket.status === "awaiting_payment_confirm" ||
    ticket.status === "paid" ||
    ticket.status === "awaiting_story" ||
    ticket.status === "revealed";
  const paidDone =
    ticket.status === "paid" ||
    ticket.status === "awaiting_story" ||
    ticket.status === "revealed";
  const storyDone = ticket.status === "revealed";
  const revealedDone = ticket.status === "revealed";

  const active = (() => {
    if (!paymentPromptDone) return "awaiting_payment_confirm";
    if (!paidDone) return "paid";
    if (!storyDone) return "awaiting_story";
    return "revealed";
  })();

  return [
    {
      key: "created",
      label: "Created",
      state: active === "created" ? "active" : done(createdDone),
    },
    {
      key: "awaiting_payment_confirm",
      label: "Payment",
      state:
        active === "awaiting_payment_confirm"
          ? "active"
          : done(paymentPromptDone),
    },
    {
      key: "paid",
      label: "Paid",
      state: active === "paid" ? "active" : done(paidDone),
    },
    {
      key: "awaiting_story",
      label: "Story",
      state: active === "awaiting_story" ? "active" : done(storyDone),
    },
    {
      key: "revealed",
      label: "Revealed",
      state: active === "revealed" ? "active" : done(revealedDone),
    },
  ];
}

function titleFor(ticket: BusinessTicket): string {
  const name = ticket.consumer?.full_name?.trim();
  const code = ticket.consumer?.code?.trim();
  if (name) return name;
  if (code) return `Guest ${code}`;
  return "Guest";
}

function ageFromBirthday(birthday: string | null): number | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function sexLabel(sex: string | null): string | null {
  if (!sex) return null;
  const s = sex.trim().toLowerCase();
  if (s === "m" || s === "male" || s === "man") return "Male";
  if (s === "f" || s === "female" || s === "woman") return "Female";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function planLabel(tierKey: string | null | undefined): string {
  return tierKey === "premium" ? "Premium" : "Free";
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatConsumerCodeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function TicketsClient({
  venueId,
  venueCurrency,
  initialTickets,
}: {
  venueId: string;
  venueCurrency: string;
  initialTickets: BusinessTicket[];
}) {
  const supabase = useBrowserSupabase();
  const [tickets, setTickets] = useState(initialTickets);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [guestCode, setGuestCode] = useState("");
  const [ticketType, setTicketType] = useState<ScanTicketType>("A");
  const [subtotalText, setSubtotalText] = useState("");
  const [tipText, setTipText] = useState("");

  const refresh = async () => {
    setBusy("refresh");
    setError(null);
    try {
      const rows = await apiListTickets(supabase, { venueId, limit: 40 });
      setTickets(rows);
      setNotice(`Updated ${rows.length} tickets.`);
    } catch (e) {
      setError(errMsg(e, "Couldn't refresh tickets."));
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (ticketId: string) => {
    setBusy(`pay:${ticketId}`);
    setError(null);
    setNotice(null);
    try {
      const res = await apiMarkTicketPaid(supabase, ticketId);
      const rows = await apiListTickets(supabase, { venueId, limit: 40 });
      setTickets(rows);
      setNotice(
        res.awaitingStory
          ? "Payment confirmed. Ticket is waiting for story verification."
          : "Ticket marked as paid.",
      );
    } catch (e) {
      setError(errMsg(e, "Couldn't mark ticket as paid."));
    } finally {
      setBusy(null);
    }
  };

  const cancelTicket = async (ticketId: string) => {
    setBusy(`cancel:${ticketId}`);
    setError(null);
    setNotice(null);
    try {
      await apiCancelTicket(supabase, {
        ticketId,
        reason: "Cancelled from business console",
      });
      const rows = await apiListTickets(supabase, { venueId, limit: 40 });
      setTickets(rows);
      setNotice("Ticket cancelled.");
    } catch (e) {
      setError(errMsg(e, "Couldn't cancel ticket."));
    } finally {
      setBusy(null);
    }
  };

  const createTicket = async () => {
    const code = guestCode.trim().toUpperCase();
    const codeDigits = code.replace(/\D/g, "");
    const subtotal = Number(subtotalText);
    const tip = tipText.trim() ? Number(tipText) : 0;
    if (!code) {
      setError("Guest number/code is required.");
      return;
    }
    if (codeDigits.length !== 8) {
      setError("Guest code must be 8 digits (0000-0000).");
      return;
    }
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      setError("Subtotal must be greater than 0.");
      return;
    }
    if (!Number.isFinite(tip) || tip < 0) {
      setError("Tip must be 0 or greater.");
      return;
    }

    setBusy("create");
    setError(null);
    setNotice(null);
    try {
      await apiCreateTicket(supabase, {
        venueId,
        consumerCode: code,
        checkSubtotalCents: Math.round(subtotal * 100),
        tipCents: Math.round(tip * 100),
        kind: TICKET_KIND_BY_TYPE[ticketType],
      });
      const rows = await apiListTickets(supabase, { venueId, limit: 40 });
      setTickets(rows);
      setGuestCode("");
      setSubtotalText("");
      setTipText("");
      setNotice("Ticket created.");
    } catch (e) {
      setError(errMsg(e, "Couldn't create ticket."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Create ticket"
        description="Open a new check by entering the guest number/code."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <label className="md:col-span-2">
            <span className={TINY_LABEL_CLASS}>Guest number/code</span>
            <input
              value={guestCode}
              onChange={(e) => setGuestCode(formatConsumerCodeInput(e.target.value))}
              placeholder="0000-0000"
              inputMode="numeric"
              autoComplete="off"
              className="border-border bg-background mt-1 h-10 w-full rounded-xl border px-3 text-sm outline-none"
            />
          </label>
          <label>
            <span className={TINY_LABEL_CLASS}>Ticket type</span>
            <select
              value={ticketType}
              onChange={(e) => setTicketType(e.target.value as ScanTicketType)}
              className="border-border bg-background mt-1 h-10 w-full rounded-xl border px-3 text-sm outline-none"
            >
              <option value="A">Type A · Discount · No story</option>
              <option value="B">Type B · Discount · Story</option>
              <option value="C">Type C · Cashback · No story</option>
              <option value="D">Type D · Cashback · Story</option>
            </select>
          </label>
          <label>
            <span className={TINY_LABEL_CLASS}>Subtotal ({venueCurrency})</span>
            <input
              value={subtotalText}
              onChange={(e) => setSubtotalText(e.target.value)}
              placeholder="850"
              inputMode="decimal"
              className="border-border bg-background mt-1 h-10 w-full rounded-xl border px-3 text-sm outline-none"
            />
          </label>
          <label>
            <span className={TINY_LABEL_CLASS}>Tip ({venueCurrency})</span>
            <input
              value={tipText}
              onChange={(e) => setTipText(e.target.value)}
              placeholder="120"
              inputMode="decimal"
              className="border-border bg-background mt-1 h-10 w-full rounded-xl border px-3 text-sm outline-none"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-[12px]">
            Flow type (mock):{" "}
            <span className="font-medium">
              Type {ticketType} · {TICKET_KIND_BY_TYPE[ticketType]} · rewards fallback to 0% if not configured
            </span>
          </p>
          <button
            type="button"
            className={cn(PILL_BUTTON_CLASS, "px-3 py-1.5")}
            onClick={() => void createTicket()}
            disabled={busy === "create"}
          >
            {busy === "create" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Create ticket
          </button>
        </div>
      </Section>

      <Section
        title="Recent tickets"
        description="Mock rows across Type A/B/C/D opened by staff."
        right={
          <button
            type="button"
            className={cn(PILL_BUTTON_CLASS, "px-3 py-1.5")}
            onClick={() => void refresh()}
            disabled={busy === "refresh"}
          >
            {busy === "refresh" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
          {notice ? <p className={INFO_BOX_CLASS}>{notice}</p> : null}
          {tickets.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="text-muted-foreground h-5 w-5" />}
              title="No tickets yet"
              description="As soon as staff opens tickets, they will appear here for review."
            />
          ) : (
            tickets.map((t) => {
              const pendingPay =
                t.status === "pending_pay" || t.status === "awaiting_payment_confirm";
              const canCancel = t.status === "pending_pay";
              const rewardCents =
                (t.cashback_cents ?? 0) + (t.discount_cents ?? 0) + (t.redeem_cents ?? 0);
              const age = ageFromBirthday(t.consumer?.birthday ?? null);
              const sex = sexLabel(t.consumer?.sex ?? null);
              const country = t.consumer?.country?.trim() || null;
              const plan = planLabel(t.consumer?.tier_key);
              const payBusy = busy === `pay:${t.id}`;
              const cancelBusy = busy === `cancel:${t.id}`;
              const lifecycle = lifecycleFor(t);
              return (
                <article
                  key={t.id}
                  className="border-border bg-background rounded-2xl border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{titleFor(t)}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {t.consumer?.code ? `Code ${t.consumer.code}` : "No code"} ·{" "}
                        {new Date(t.created_at).toLocaleDateString()} · {hourLabel(t.created_at)}
                      </p>
                      <p className="text-muted-foreground mt-1 text-[11px]">
                        {[
                          age != null ? `${age}y` : "Age —",
                          sex ?? "Sex —",
                          country ?? "Country —",
                          `Plan ${plan}`,
                          `Reward ${centsToMoney(rewardCents, t.currency)}`,
                        ].join("  ·  ")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusTone(t.status),
                      )}
                    >
                      {t.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] md:grid-cols-4">
                    <p>
                      <span className={TINY_LABEL_CLASS}>Total</span>
                      <br />
                      <span className="font-medium">
                        {centsToMoney(t.total_cents, t.currency)}
                      </span>
                    </p>
                    <p>
                      <span className={TINY_LABEL_CLASS}>Cashback</span>
                      <br />
                      <span className="font-medium">
                        {centsToMoney(t.cashback_cents, t.currency)}
                      </span>
                    </p>
                    <p>
                      <span className={TINY_LABEL_CLASS}>Redeem</span>
                      <br />
                      <span className="font-medium">
                        {centsToMoney(t.redeem_cents, t.currency)}
                      </span>
                    </p>
                    <p>
                      <span className={TINY_LABEL_CLASS}>Kind</span>
                      <br />
                      <span className="font-medium">{t.kind}</span>
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className={TINY_LABEL_CLASS}>Lifecycle</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {lifecycle.map((step) => (
                        <span
                          key={step.key}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            step.state === "done" && "bg-emerald-500/10 text-emerald-700",
                            step.state === "active" && "bg-foreground text-background",
                            step.state === "upcoming" && "bg-muted text-muted-foreground",
                          )}
                        >
                          {step.label}
                        </span>
                      ))}
                      {t.status === "cancelled" ? (
                        <span className="bg-rose-500/10 text-rose-700 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          Cancelled
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {(pendingPay || canCancel) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pendingPay ? (
                        <button
                          type="button"
                          onClick={() => void markPaid(t.id)}
                          disabled={payBusy || busy === "refresh"}
                          className={cn(PILL_BUTTON_CLASS, "px-3 py-1.5")}
                        >
                          {payBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Mark paid
                        </button>
                      ) : null}
                      {canCancel ? (
                        <button
                          type="button"
                          onClick={() => void cancelTicket(t.id)}
                          disabled={cancelBusy || busy === "refresh"}
                          className="border-border bg-card text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-60"
                        >
                          {cancelBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </Section>
    </div>
  );
}
