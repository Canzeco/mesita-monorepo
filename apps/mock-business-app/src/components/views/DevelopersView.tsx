"use client";

// DEVELOPERS PLATFORM — the key and the connector (MESITA-1992).
//
// Pato, looking at the pane the rename left behind: *"mention API key and MCP
// here."*
//
// MESITA-1991 gave the product its name and its reason, and left it on the
// "Not here yet" empty state — which was wrong twice. The card says the product
// is ON for every place, and then the pane said nothing was here: a live
// product wearing an unbuilt product's screen. And the two things a developer
// actually comes for were the two things missing.
//
// ── THE TWO THINGS A PLACE HANDS SOMEBODY ──────────────────────────────────
//
//   THE KEY         a secret, scoped to THIS place, that a POS or a script
//                   authenticates with. Shown masked, because a key you can
//                   read off a shared screen is a key you have to rotate.
//   THE CONNECTOR   an MCP endpoint. The same account, reachable by an AI
//                   assistant instead of by code — point Claude or ChatGPT at
//                   it and it can read this place's orders and bookings and
//                   answer from its own menu.
//
// They are the SAME product on purpose. 🦚 Main gives the guest side an MCP
// connector already; this is that access arriving on the place's side, and
// splitting "API" and "MCP" into two rows in the index would sell one product
// twice.
//
// ── PER PLACE, NEVER PER PERSON ────────────────────────────────────────────
//
// The key hangs on the PLACE, like the Stripe account and the Credits balance
// do (🦚 Main §7, Places Governance). A place that changes hands keeps its
// integrations; a manager who leaves takes nothing with them. That is the one
// sentence this screen has to make unambiguous — it is the API key Group's
// footer, not a footnote buried under the secret.
//
// THE KEY IS DERIVED FROM THE PLACE ID, not a constant. A mock that shows
// every place the same secret teaches that the secret is not per place, which
// is the exact fact this screen exists to teach.
//
// ── SETUP STANDARD (MESITA-2034) ────────────────────────────────────────────
//
// Three Groups: API key (one Rule row, footer = the per-place sentence),
// MCP connector (one Rule row), What it carries (one info block, allowOneRow —
// it is a two-item explainer, not a list of settings).
import { KeyRound, Plug, RefreshCw } from "lucide-react";
import { Group } from "@/components/shared/Group";
import { Rule } from "@/components/shared/Rule";
import { Half } from "@/components/shared/Half";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

/** A stable, obviously-fake tail for this place's key. Hex so it reads like a
 *  secret rather than like the slug it came from. */
function tail(placeId: string): string {
  let h = 0x811c9dc5;
  for (const ch of placeId) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 8);
}

export function DevelopersView() {
  const place = useHeldPlace();
  const suffix = tail(place.id);

  return (
    <div className="flex flex-col gap-4">
      <Half label="Manage">
        <Group
          title="API key"
          description="One secret per place. Whoever builds for you authenticates with it — your POS, a script, an agency."
          right={
            <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Rotate
            </button>
          }
          footer={
            <>
              <KeyRound className="mr-1.5 -mt-0.5 inline h-3.5 w-3.5" aria-hidden />
              Keys are issued per place, never per person. It belongs to{" "}
              {place.name} the way the Stripe account and the Credits balance
              do: a manager who leaves takes nothing with them, and a place
              that changes hands keeps its integrations running.
            </>
          }
        >
          <Rule
            label="Live key"
            note={
              <>
                <span className="font-mono tracking-tight">{`mk_live_${"•".repeat(16)}${suffix}`}</span>
                <br />
                Shown once when it is issued, masked from then on. Rotating it
                breaks anything still using the old key, immediately and on
                purpose.
              </>
            }
            control={{ kind: "button", label: "Copy", onClick: () => {} }}
          />
        </Group>

        <Group
          title="MCP connector"
          description="The same access, reachable by an AI assistant instead of by code."
          footer="It reads and it books. It never changes your prices, your rewards or your payout account — those stay in this console, behind a person."
        >
          <Rule
            label="Endpoint"
            note={
              <>
                <span className="font-mono tracking-tight">{`https://mcp.mesita.ai/places/${place.id}`}</span>
                <br />
                Add it in Claude or ChatGPT with the key above. The assistant
                then reads this place&apos;s orders and bookings, quotes its
                Digital Menu, and answers about its hours — the same account,
                no second login.
              </>
            }
            control={{ kind: "button", label: "Copy", onClick: () => {} }}
          />
        </Group>

        <Group
          title="What it carries"
          description="Orders and bookings land where you already work, instead of on a screen somebody has to watch."
          allowOneRow
        >
          <div className="p-3">
            <ul className="text-muted-foreground flex flex-col gap-2 text-[13px] leading-snug">
              <li className="flex gap-2">
                <Plug className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  <span className="text-foreground font-medium">Push</span> — a
                  new order or reservation goes straight into your POS or your
                  own system, with the guest, the dishes and what was already
                  paid.
                </span>
              </li>
              <li className="flex gap-2">
                <Plug className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  <span className="text-foreground font-medium">Pull</span> —
                  your menu, hours and today&apos;s bookings, readable by
                  whatever you run, so nothing is maintained twice.
                </span>
              </li>
            </ul>
          </div>
        </Group>
      </Half>

      {/* NO LOG OF ITS OWN, and that is not an oversight: what the API pushed
          is an ORDER and a BOOKING, and both are already rows in this place's
          whole log. A call counter here would be a second timeline for events
          that already have one. */}
      <Half label="Activity">
        <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
          <span aria-hidden className="text-4xl leading-none opacity-60">
            {"\u{1F50C}"}
          </span>
          <p className="font-display text-sm font-semibold tracking-tight">
            No log of its own
          </p>
          <p className="text-muted-foreground max-w-[44ch] text-[13px] leading-snug">
            What the key and the connector do arrives as orders and bookings,
            and those are rows on Online Orders&apos; and Online
            Reservations&apos; own Activity.
          </p>
        </div>
      </Half>
    </div>
  );
}
