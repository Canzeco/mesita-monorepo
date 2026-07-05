import type { BusinessTicket } from "@/lib/api/tickets";
import { ticketFlowTypeFromKind } from "@/lib/ticket-staff-lifecycle";
import { planLabel } from "@/lib/consumer-plan";

export function centsToMoney(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "MXN",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function ticketTitle(ticket: BusinessTicket): string {
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

export function ticketConsumerMetaLine(ticket: BusinessTicket): string {
  const age = ageFromBirthday(ticket.consumer?.birthday ?? null);
  const sex = sexLabel(ticket.consumer?.sex ?? null);
  const country = ticket.consumer?.country?.trim() || null;
  const plan = planLabel(ticket.consumer?.class_key);
  const rewardCents = (ticket.discount_cents ?? 0) + (ticket.redeem_cents ?? 0);

  return [
    age != null ? `${age}y` : "Age —",
    sex ?? "Sex —",
    country ?? "Country —",
    `Plan ${plan}`,
    `Reward ${centsToMoney(rewardCents, ticket.currency)}`,
  ].join("  ·  ");
}

export function ticketOpenedMetaLine(ticket: BusinessTicket): string {
  const code = ticket.consumer?.code?.trim();
  const d = new Date(ticket.created_at);
  const date = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });
  const time = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${code ? `Code ${code}` : "No code"} · ${date} · ${time}`;
}

export function formatConsumerCodeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function ticketFlowTypeLabel(ticket: BusinessTicket): string {
  return `Type ${ticketFlowTypeFromKind(ticket.kind)}`;
}
