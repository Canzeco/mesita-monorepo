// What the place screen's pinned row says (MESITA-4151, Pato: "only two
// buttons ... reservations button must be black, and the offers button must
// be moving ... just like the banner in home"): Reserve · Offers. Wallet and
// Pay left the row; the bar has both. Each tile either WORKS here or is Off,
// and nothing is typed in here: Reserve reads the place's own bit, Offers the
// server's list-vouchers read (place.money) through the shared slides.

import type { PlaceDetail } from "../place-detail";
import { offerDetailSlides, type OfferSlide } from "./offers";
import { isReserveActionEnabled } from "./place-profile-actions";

/** `note`: what the Off sheet says instead of its standard line (MESITA-3604). */
export type MesitaTileState = { works: boolean; note?: string };
export type MesitaRowState = {
  reserve: MesitaTileState;
  /** Offers works when at least one slide shows; `loading` while the first
   *  money read is out. */
  offers: MesitaTileState & { loading: boolean; slides: OfferSlide[] };
};

/** The Offers Off sheet while Mesita pauses voucher sales. */
export const PREPAY_PAUSED = "Prepay is paused for a moment. Try again soon.";

export function mesitaRowState(place: Pick<PlaceDetail, "reservations_enabled" | "money">, loading = false): MesitaRowState {
  const reserve: MesitaTileState = { works: isReserveActionEnabled(place) };
  const money = place.money;
  // No read yet: a quiet "…" while it is out; none coming (admin's preview,
  // a Google-only card): Off, never a promised offer.
  if (!money) return { reserve, offers: { works: false, loading, slides: [] } };
  // The whole offers, one line each (MESITA-4155).
  const slides = offerDetailSlides(money);
  // Mesita's own "Pause voucher sales" is not the place's choice (MESITA-3604).
  const paused = Object.values(money.unavailable ?? {}).includes("paused");
  return {
    reserve,
    offers: slides.length > 0
      ? { works: true, loading: false, slides }
      : { works: false, loading: false, slides, ...(paused ? { note: PREPAY_PAUSED } : {}) },
  };
}
