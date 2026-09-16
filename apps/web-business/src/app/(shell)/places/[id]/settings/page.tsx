// Settings — THE PLACE'S OWN SETUP, and nothing else.
//
// Pato, 2026-09-14, on the page this replaced: *"Remove places from here, its
// redundant. five boxes: brand · members · stripe · partnership ·
// developers."* Then, 2026-09-15: *"Configuration (here have members shit) ·
// Products (here have partner and all the products to activate…)"*, then
// *"remove brand configuration from here"*, then *"rename configuration to
// settings and use to normal settings icon."*
//
// WHAT IS LEFT IS TWO BOXES, and they are the two the name covers: who may
// touch this place, and how an agent drives it.
//
// IT IS THE PLACE'S PAGE NOW (MESITA-1892). It was the organization's, at
// `/orgs/<id>/settings`, and everything on it was really about the venue
// underneath: `place_members` was always where the people were, which is why
// the organization's own member endpoints were deletable twins rather than a
// migration. The address fell one level and the content did not move.
//
// THE TWO PAID BOXES LEFT (MESITA-1869). Mesita Partner and Mesita Pay were
// the right boxes in the wrong room: a subscription and a payment account are
// PRODUCTS — things you buy and turn on — not things you set. The catalogue is
// where an operator goes to buy, so that is where they went, composition
// intact (MESITA-1866's account / seam / switch, MESITA-1867's two tiers).
// Stripe's stored `?connect=` follows them: the bare `/places/<id>` forwards it
// to `products/pay`.
//
// BRAND LEFT AFTER THEM (MESITA-1870). It was the second Soon on a page just
// cut to what you actually set, and the weaker of the two: Developers is
// something this place will DO — keys it holds, an agent it drives — while a
// logo and the colour the loyalty card wears is a design decision with no
// column, no owner and no next step. Two dashed rows under one live box read
// as a page that is mostly not built; one reads as a page with one thing
// coming.
//
// THE NAME IS SETTINGS, LABEL AND SEGMENT (MESITA-1871). It was Settings for
// one day in MESITA-1841, Configuration from MESITA-1852, and the rename was
// forced rather than chosen: the flat `/settings` was owned by a PERMANENT
// legacy redirect onto `/capabilities`, so the page it named could never carry
// a flat twin. That rule is deleted (`next.config.ts`), checked first against
// the live 308's `must-revalidate`, so the name resolves instead of being
// shadowed. `/places/<id>/settings` was a redirect source too — the retired
// spelling of a place view — and MESITA-1892 had to delete that rule in the
// same commit for exactly the same reason.
//
// THE PAGE READS NOTHING. The layout above resolved the place once
// (MESITA-1875); the heading is its `PlaceHeading`, and the team comes through
// `PlaceContext`.
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import { SettingsBody } from "./SettingsBody";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <SettingsBody />
      <SoonStrip {...SOON_STRIPS.developers} />
    </>
  );
}
