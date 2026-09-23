"use client";

// DIGITAL MENU — the product, finally drawn (MESITA-1984).
//
// Pato: *"make the digital menu page to follow mesita notion main. read
// guidelines. basically it enables to create one menu and all that shit. not
// hosted in drive. hosted in mesita."*
//
// 🦚 Main §4 is the spec and it is specific:
//
//   "Your dishes and prices as something Mesita can read, instead of a PDF a
//    guest downloads and nothing else can use. An AI builds it from the menu
//    you already have — a photo, a file, your website — so you approve a draft
//    rather than type eighty dishes, and it can generate the dish photography
//    you never shot. Every dish carries a price per channel: one at the table,
//    another for pickup, another for delivery. Each dish also carries the
//    headline nutrition a guest scans before the blurb — kcal, protein, carbs,
//    fat — and a missing estimate is a dash (MESITA-2060). Guests reach it by scanning the
//    QR on the table, with no app and no account… It is also the one menu the
//    rest of the suite reads: Online Orders sells from it and the Answering
//    Agent quotes it on the phone."
//
// ── WHAT THIS REPLACES ─────────────────────────────────────────────────────
//
// `MenusSection` on Profile: a name, and a PDF you either uploaded or linked
// from Google Drive. That is the thing this product exists to end — a file is
// not readable by Orders, not quotable by the Agent, and not answerable to a
// guest. It leaves Profile with this issue. The menu is not a document the
// place stores; it is data Mesita holds.
//
// ── SETUP STANDARD (MESITA-2034) ────────────────────────────────────────────
//
// Four Groups: Published (state row), Start from the menu you have (one
// door row), The menu (a Table with `groups` — one row-group per section,
// keeping "the heads ride with the section" law this file wrote), The scan
// (one row). `Table`'s row-group head is deliberately NOT sticky (see
// Table.tsx's own header comment on the incident that guards against).
import { QrCode } from "lucide-react";
import { Group } from "@/components/shared/Group";
import { Rule } from "@/components/shared/Rule";
import { Badge } from "@/components/shared/Badges";
import { Table, type Column, type TableGroup } from "@/components/shared/Table";
import { usePlaceScope } from "@/components/console/PlaceScope";
import { day } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { MENU_SECTIONS } from "@/mock/fixtures";
import { money } from "@/lib/format";
import { nutritionLine } from "@/lib/nutrition";

type Dish = (typeof MENU_SECTIONS)[number]["dishes"][number];

/** The three channels, named once. The ORDER is the spec's own — table, then
 *  pickup, then delivery — and it is also the order a place thinks in: the room
 *  first, then the two ways food leaves it. */
const CHANNELS: [string, (d: Dish) => number | null][] = [
  ["Table", (d) => d.table],
  ["Pickup", (d) => d.pickup],
  ["Delivery", (d) => d.delivery],
];

function priceText(cents: number | null) {
  // NOT ON THIS CHANNEL, said as a dash. The kitchen does not send this dish
  // out, and a place has to see that at a glance rather than hunt for a number
  // that is not there.
  return cents === null ? "—" : money(cents);
}

export function MenuView() {
  const { place } = usePlaceScope();
  const dishes = MENU_SECTIONS.reduce((n, s) => n + s.dishes.length, 0);

  const columns: Column<Dish>[] = [
    {
      key: "dish",
      head: "Dish",
      cell: (d) => (
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">{d.name}</p>
          <p className={d.nutrition ? "text-[11.5px] tabular-nums" : "text-muted-foreground text-[11.5px]"}>
            {nutritionLine(d.nutrition)}
          </p>
          <p className="text-muted-foreground line-clamp-1 text-[11.5px] leading-snug">{d.blurb}</p>
        </div>
      ),
    },
    ...CHANNELS.map(([label, read]) => ({
      key: label,
      head: label,
      align: "right" as const,
      cell: (d: Dish) => <span className="tabular-nums">{priceText(read(d))}</span>,
    })),
  ];

  const groups: TableGroup<Dish>[] = MENU_SECTIONS.map((s) => ({
    id: s.id,
    name: s.name,
    rows: s.dishes,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* PUBLISHED OR NOT (MESITA-2017). Three products read the published
          menu and the agent never reads a draft, so the one fact this screen
          owes before the list is whether Publish has been pressed. */}
      {place && (
        <Group title="Published">
          <Rule
            label={place.menuPublishedAt ? "Published" : "Draft"}
            note={
              place.menuPublishedAt
                ? `Published ${day(place.menuPublishedAt)}. The QR, your page, Online Orders and the Answering Agent all read this version; edits below stay a draft until you publish again.`
                : "Nothing is public yet. Online Orders, the Answering Agent and the Express Website wait on this button."
            }
            badge={<Badge tone={place.menuPublishedAt ? "live" : "off"}>{place.menuPublishedAt ? "On" : "Not yet"}</Badge>}
            control={{ kind: "button", label: place.menuPublishedAt ? "Publish changes" : "Publish", emphasis: "primary", onClick: () => {} }}
          />
        </Group>
      )}

      {/* THE DRAFT, FIRST, because the spec's whole promise is that you do not
          type eighty dishes. */}
      <Group title="Start from the menu you already have" allowOneRow>
        <Rule
          label="A photo, a PDF or your website"
          note="Mesita reads it and writes the draft, so you approve dishes and prices instead of typing them. It can shoot the dish photography you never took."
          control={{ kind: "button", label: "Build my menu", onClick: () => {} }}
        />
      </Group>

      <Group
        title="The menu"
        description={`${MENU_SECTIONS.length} sections · ${dishes} dishes · three prices each, and the headline nutrition.`}
        right={<button type="button" className={GHOST_PILL_BUTTON_CLASS}>Add a dish</button>}
      >
        <Table columns={columns} groups={groups} inCard minWidth={520} />
      </Group>

      {/* THE SCAN IS THE POINT (Main §4) — the only Mesita surface a guest
          reaches with no app and no account. */}
      <Group title="The scan" description="How a guest reaches it. No app, no account.">
        <Rule
          label="Table QR"
          note="Opens this menu in any phone camera. It answers for itself — what is in a dish, what is lightest, what the kitchen is known for — from what you entered here, never invented."
          control={{
            kind: "value",
            text: (
              <span className="inline-flex items-center gap-2">
                <QrCode className="h-4 w-4" aria-hidden />
                {place ? `mesita.ai/m/${place.id.replace(/^plc_/, "")}` : ""}
              </span>
            ),
          }}
        />
        <Rule
          label="Print the QR"
          note="Who else reads it: Online Orders sells from this menu and the Answering Agent quotes it on the phone."
          control={{ kind: "button", label: "Print the QR", onClick: () => {} }}
        />
      </Group>
    </div>
  );
}
