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
//    another for pickup, another for delivery. Guests reach it by scanning the
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
// ── THE FOUR BANDS, IN THE ORDER THE SPEC PUTS THEM ────────────────────────
//
//   THE DRAFT     you approve a menu, you do not type eighty dishes
//   THE MENU      sections, dishes, and THREE prices each
//   THE SCAN      the QR, the only Mesita surface needing no app
//   WHO READS IT  Orders sells from it, the Agent quotes it
//
// THREE PRICE COLUMNS, NOT ONE PRICE AND TWO MODIFIERS. A place sets them
// independently: the table pays for the room, pickup is often the cheapest
// thing on the menu on purpose, and delivery carries a courier. A NULL is a
// real answer — the tuétano does not survive a courier — so it draws a dash.
// A zero would say the dish is free.
import { QrCode, Sparkles, Wand2 } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { usePlaceScope } from "@/components/console/PlaceScope";
import { MENU_SECTIONS } from "@/mock/fixtures";
import { money } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

type Dish = (typeof MENU_SECTIONS)[number]["dishes"][number];

/** The three channels, named once. The ORDER is the spec's own — table, then
 *  pickup, then delivery — and it is also the order a place thinks in: the room
 *  first, then the two ways food leaves it. */
const CHANNELS = [
  ["Table", (d: Dish) => d.table],
  ["Pickup", (d: Dish) => d.pickup],
  ["Delivery", (d: Dish) => d.delivery],
] as const;

function Price({ cents }: { cents: number | null }) {
  // NOT ON THIS CHANNEL, said as a dash. The kitchen does not send this dish
  // out, and a place has to see that at a glance rather than hunt for a number
  // that is not there.
  if (cents === null) {
    return (
      <>
        <span aria-hidden className="text-muted-foreground/60">
          —
        </span>
        <span className="sr-only">not sold on this channel</span>
      </>
    );
  }
  return <span className="tabular-nums">{money(cents)}</span>;
}

export function MenuView() {
  const { place } = usePlaceScope();
  const dishes = MENU_SECTIONS.reduce((n, s) => n + s.dishes.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* THE DRAFT, FIRST, because the spec's whole promise is that you do not
          type eighty dishes. A dashed band rather than a card: an operator who
          already has a menu should meet this before they meet the list they
          would otherwise be editing by hand. */}
      <div className="border-border flex flex-wrap items-center gap-3 rounded-2xl border border-dashed p-4">
        <Wand2 className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 basis-64">
          <p className="font-display text-sm font-semibold tracking-tight">
            Start from the menu you already have
          </p>
          <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
            A photo, a PDF or your website. Mesita reads it and writes the
            draft, so you approve dishes and prices instead of typing them. It
            can shoot the dish photography you never took.
          </p>
        </div>
        <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Build my menu
        </button>
      </div>

      <Section
        title="The menu"
        description={`${MENU_SECTIONS.length} sections · ${dishes} dishes · three prices each.`}
        right={
          <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
            Add a dish
          </button>
        }
      >
        <div className="flex flex-col gap-5">
          {MENU_SECTIONS.map((section) => (
            <section key={section.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-sm font-semibold tracking-tight">
                  {section.name}
                </h3>
                {/* THE COLUMN HEADS RIDE WITH THE SECTION, not with the card.
                    At this width the prices are three 64px columns, and a
                    header row a whole section away from them stops being a
                    label and becomes decoration. */}
                <div className="text-muted-foreground flex shrink-0 gap-3">
                  {CHANNELS.map(([label]) => (
                    <span
                      key={label}
                      className={cn(TINY_LABEL_CLASS, "w-16 text-right")}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-border divide-border divide-y rounded-2xl border">
                {section.dishes.map((dish) => (
                  <div key={dish.id} className="flex items-center gap-3 p-3">
                    {dish.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a data-URI thumbnail; next/image buys nothing here
                      <img
                        src={dish.photoUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="bg-muted h-12 w-12 shrink-0 rounded-xl"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold tracking-tight">
                        {dish.name}
                      </p>
                      <p className="text-muted-foreground line-clamp-2 text-[12px] leading-snug">
                        {dish.blurb}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-3 text-[13px] font-medium">
                      {CHANNELS.map(([label, read]) => (
                        <span key={label} className="w-16 text-right">
                          <Price cents={read(dish)} />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Section>

      {/* THE SCAN IS THE POINT (Main §4) — the only Mesita surface a guest
          reaches with no app and no account — so it gets a band rather than a
          line, and it names the address it opens instead of implying one. */}
      <Section
        title="The scan"
        description="How a guest reaches it. No app, no account."
      >
        <div className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl"
          >
            <QrCode className="h-9 w-9" />
          </span>
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-[13px] leading-snug">
              The QR on the table opens this menu in any phone camera. It
              answers for itself — what is in a dish, what is lightest, what the
              kitchen is known for — from what you entered here, never invented.
            </p>
            {place && (
              <p className="text-muted-foreground mt-1 text-[12px] tabular-nums">
                mesita.ai/m/{place.id.replace(/^plc_/, "")}
              </p>
            )}
          </div>
          <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
            Print the QR
          </button>
        </div>
      </Section>

      {/* WHO ELSE READS IT. The menu is not a page this product owns; it is the
          one list the rest of the suite quotes. Saying so here is what stops an
          operator keeping a second menu somewhere else. */}
      <p className="text-muted-foreground text-[12px] leading-snug">
        Online Orders sells from this menu and the Answering Agent quotes it on
        the phone. Change a price here and both change with it.
      </p>
    </div>
  );
}
