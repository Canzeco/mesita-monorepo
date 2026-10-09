"use client";

// Settings › Developers — API key door + MCP connector door (MESITA-1912).
// Ported from the mock Developers pane (MESITA-1992); MCP stays Soon until a
// place-scoped MCP server ships — a connector URL with nothing behind it is
// the fabricated state this console refuses.
import { KeyRound, Plug } from "lucide-react";
import { CopyIdButton } from "@/components/admin-ui/manage";
import { SoonStrip } from "@/components/console/SoonStrip";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { Section } from "@/components/shared/Section";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { PlaceApiKeysPanel } from "./PlaceApiKeysPanel";

function ClientMarks() {
  return (
    <div
      className="text-muted-foreground flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-wide uppercase"
      aria-label="Works with MCP, Claude, and ChatGPT"
    >
      <span className="border-border rounded-md border px-2 py-0.5">MCP</span>
      <span className="border-border rounded-md border px-2 py-0.5">
        Claude
      </span>
      <span className="border-border rounded-md border px-2 py-0.5">
        ChatGPT
      </span>
    </div>
  );
}

export function DevelopersSection() {
  const { place } = usePlaceContext();
  if (!place) return null;

  const placeName = place.name?.trim() || "this place";

  return (
    <Section
      lane
      title="Developers"
      description="API keys and what an agent needs to read and drive this place."
    >
      <div className="flex flex-col gap-4">
        <Section
          title="Place ID"
          description="Every integration names this place. Keys and connectors are scoped to it and to nothing else."
        >
          <div className="border-border bg-page flex flex-wrap items-center gap-3 rounded-xl border p-3">
            <div className="min-w-0 flex-1">
              <p className={TINY_LABEL_CLASS}>ID</p>
              <p className="mt-1 truncate font-mono text-[13px] tracking-tight">
                {place.id}
              </p>
            </div>
            <CopyIdButton id={place.id} />
          </div>
        </Section>

        <Section
          title="API key"
          description="One secret per place. Whoever builds for you authenticates with it — your POS, a script, an agency."
        >
          <PlaceApiKeysPanel placeId={place.id} />
          <div className="flex items-start gap-3 px-1">
            <KeyRound
              className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
              aria-hidden
            />
            <p className="text-muted-foreground text-[12px] leading-snug">
              <span className="text-foreground font-medium">
                Keys are issued per place, never per person.
              </span>{" "}
              They belong to {placeName} the way the Stripe account and the
              Credits balance do.
            </p>
          </div>
        </Section>

        <Section
          title="MCP connector"
          description="The same access, reachable by an AI assistant instead of by code."
        >
          <SoonStrip
            title="Connector URL"
            line="Paste into Claude or ChatGPT with your place key — same account, no second login."
          />
          <ClientMarks />
          <p className="text-muted-foreground px-1 text-[12px] leading-snug">
            It reads and it books. It never changes your prices, rewards, or
            payout account.
          </p>
        </Section>

        <Section
          title="What it carries"
          description="Orders and bookings land where you already work."
        >
          <ul className="text-muted-foreground flex flex-col gap-2 text-[13px] leading-snug">
            <li className="flex gap-2">
              <Plug className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                <span className="text-foreground font-medium">Push</span> —
                new orders and reservations into your POS or your own system.
              </span>
            </li>
            <li className="flex gap-2">
              <Plug className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                <span className="text-foreground font-medium">Pull</span> —
                menu, hours, and today&apos;s bookings readable by what you run.
              </span>
            </li>
          </ul>
        </Section>
      </div>
    </Section>
  );
}
