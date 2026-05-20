import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Instagram,
  Percent,
} from "lucide-react";
import { KIND_LABEL, type TicketKind } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

// Manager education card — explains the 10-ticket taxonomy the active plan
// enables. Rendered under the Plan section in Promos: plan + fiscal type
// determines what flows the venue can run, the rate is a separate knob.

type KindRef = { kind: TicketKind; layers: string[]; warn?: boolean };

const FORMAL_REFERENCE: KindRef[] = [
  { kind: "none", layers: ["No transaction"] },
  { kind: "p_c", layers: ["Payment", "Cashback"] },
  {
    kind: "s_p_sf_c",
    layers: ["Story", "Payment", "Story-Fallback", "Cashback"],
  },
  { kind: "r_p_c", layers: ["Reservation", "Payment", "Cashback"] },
  {
    kind: "r_s_p_sf_c",
    layers: ["Reservation", "Story", "Payment", "Story-Fallback", "Cashback"],
  },
];

const INFORMAL_REFERENCE: KindRef[] = [
  { kind: "none", layers: ["No transaction"] },
  { kind: "dp", layers: ["Discounted-Payment"] },
  {
    kind: "s_dp_sf",
    layers: ["Story", "Discounted-Payment", "Story-Fallback"],
    warn: true,
  },
  { kind: "r_dp", layers: ["Reservation", "Discounted-Payment"] },
  {
    kind: "r_s_dp_sf",
    layers: ["Reservation", "Story", "Discounted-Payment", "Story-Fallback"],
    warn: true,
  },
];

export function TicketTypesCard({
  isFormal,
  planMechanic,
}: {
  isFormal: boolean;
  planMechanic: "None" | "Cashback" | "Discount";
}) {
  const rows = isFormal ? FORMAL_REFERENCE : INFORMAL_REFERENCE;
  const subtitle = isFormal
    ? "Five formal flows — each builds on None by adding Reservation, Story, or both. Cashback never lands until the story is verified, so failed stories cost the guest the cashback (not the venue)."
    : "Five informal flows — each builds on None by adding Reservation, Story, or both. The story is verified post-checkout; if it fails, the discount was already applied at the bill. That's the vulnerability flag below.";
  return (
    <section className="border-border bg-card rounded-2xl border p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Your ticket types ({rows.length})
          </h3>
          <p className="text-muted-foreground mt-1 max-w-3xl text-xs">
            {subtitle}
          </p>
        </div>
        <span className="bg-foreground/10 text-foreground rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">
          {isFormal ? "Formal" : "Informal"}
        </span>
      </header>

      {planMechanic === "None" && (
        <p className="bg-muted text-muted-foreground mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium">
          On Free the only available flow is{" "}
          <span className="font-semibold">None</span> — no Mesita transaction at
          checkout.
        </p>
      )}

      <ul className="divide-border flex flex-col divide-y">
        {rows.map((row, i) => (
          <li key={row.kind} className="flex items-start gap-3 py-2.5">
            <span className="bg-foreground text-background mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold">{KIND_LABEL[row.kind]}</p>
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono text-[9px] tracking-wider uppercase">
                  {row.kind}
                </span>
                {row.warn && (
                  <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Vulnerability
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {row.layers.map((l) => (
                  <LayerChip key={l} label={l} isFormal={isFormal} />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LayerChip({ label, isFormal }: { label: string; isFormal: boolean }) {
  const tone = (() => {
    if (label === "Reservation") return "bg-secondary/15 text-secondary";
    if (label === "Story") return "bg-pink-gradient/15 text-foreground";
    if (label === "Story-Fallback") return "bg-muted text-muted-foreground";
    if (label === "Payment") return "bg-foreground/10 text-foreground";
    if (label === "Discounted-Payment") return "bg-tier-gold/30 text-black";
    if (label === "Cashback")
      return isFormal
        ? "bg-pink-gradient text-white"
        : "bg-muted text-muted-foreground";
    if (label === "No transaction") return "bg-muted text-muted-foreground";
    return "bg-muted text-muted-foreground";
  })();
  const Icon = (() => {
    if (label === "Reservation") return Calendar;
    if (label === "Story") return Instagram;
    if (label === "Story-Fallback") return Instagram;
    if (label === "Payment") return CreditCard;
    if (label === "Discounted-Payment") return Percent;
    if (label === "Cashback") return CircleDollarSign;
    return ChevronRight;
  })();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        tone,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
