function text(payload: Record<string, unknown> | null, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function cents(payload: Record<string, unknown> | null): number | null {
  const value = payload?.amount_cents;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function money(amount: number, currency: string): string {
  return (amount / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
}

function outcome(value: string | null): string {
  switch (value) {
    case "confirmed":
      return "confirmed your table.";
    case "declined":
      return "couldn't take your table.";
    case "counter_offer":
      return "offered another time.";
    case "change_proposed":
      return "asked to change your table.";
    case "unreachable":
      return "didn't answer when Mesita called.";
    case "unresolved":
      return "didn't confirm your table yet.";
    default:
      return "updated your reservation.";
  }
}

/** The sentence Me › Notifications shows, the same words as the web. */
export function noticeSentence(kind: string, payload: Record<string, unknown> | null): { place: string; sentence: string } {
  const place = text(payload, "place_name") ?? "Mesita";
  if (kind === "credit_ready") {
    const amount = cents(payload);
    const currency = text(payload, "currency");
    const line = amount !== null && amount > 0 && currency ? `${money(amount, currency)} is ready to spend` : "Your credit is ready to spend";
    return { place, sentence: line };
  }
  return { place, sentence: outcome(text(payload, "outcome")) };
}
