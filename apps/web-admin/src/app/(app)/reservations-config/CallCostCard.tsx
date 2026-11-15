import { Receipt } from "lucide-react";
import { Notice, SectionCard, Stat } from "@/components/admin-ui";
import { getCallCost } from "./actions";

// Configurations › Reservations › Call cost (MESITA-4043, Pato: "a section
// calculating how much a one minute call of eleven labs reservation costs on
// average"). A server component under its own Suspense: ElevenLabs is read
// on page load, and a slow read never holds up the Testing card.

const usd = (n: number) => {
  const digits = n < 1 ? 3 : 2;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

function callLength(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function CallCostShell({ children }: { children: React.ReactNode }) {
  return (
    <SectionCard
      icon={<Receipt />}
      title="Call cost"
      subtitle="What one minute of a reservation call costs on ElevenLabs, on average over the last 30 days."
    >
      {children}
    </SectionCard>
  );
}

export async function CallCostCard() {
  const res = await getCallCost(30);
  if (!res.ok) {
    return (
      <CallCostShell>
        <Notice className="mt-5">{res.error}</Notice>
      </CallCostShell>
    );
  }
  const c = res.cost;
  if (c.calls === 0) {
    return (
      <CallCostShell>
        <p className="text-muted-foreground mt-5 text-sm">No reservation calls in the last 30 days yet.</p>
      </CallCostShell>
    );
  }
  const priceHint =
    c.priceSource === "invoice" ? `${c.plan} plan` : c.priceSource === "list" ? `At the ${c.plan} list price` : "Plan price unknown";
  return (
    <CallCostShell>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Per minute" value={c.usdPerMinute != null ? usd(c.usdPerMinute) : "—"} hint={priceHint} />
        <Stat
          label="Credits per minute"
          value={c.creditsPerMinute != null ? Math.round(c.creditsPerMinute).toLocaleString("en-US") : "—"}
        />
        <Stat
          label="Calls"
          value={c.calls.toLocaleString("en-US")}
          hint={`${Math.round(c.minutes).toLocaleString("en-US")} min in all${c.truncated ? " · newest only" : ""}`}
        />
        <Stat
          label="Average call"
          value={c.avgCallSeconds != null ? callLength(c.avgCallSeconds) : "—"}
          hint={c.usdPerMinute != null && c.avgCallSeconds != null ? `${usd((c.usdPerMinute * c.avgCallSeconds) / 60)} a call` : undefined}
        />
      </div>
      <p className="text-muted-foreground type-meta mt-4">
        ElevenLabs only: voice, transcription and the AI model. The phone line bills apart, on Twilio.
      </p>
    </CallCostShell>
  );
}
