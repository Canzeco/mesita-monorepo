import type { BusinessTicket } from "@/lib/api/tickets";

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
