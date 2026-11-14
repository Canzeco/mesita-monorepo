// The numbers Me › Plan states (MESITA-2167, MESITA-2555, MESITA-3870):
// reservations a month on each plan, and Pro's price.
//
// Pinned to RESERVATION_CAP_BY_PLAN (supabase/functions/_shared/
// reservation-cap.ts) and PRO_PRICE_CENTS (_shared/guest-plan.ts) by
// _shared/reservation-cap.test.ts — change them together. The page builds its
// lines from these constants, never a literal. An operator can still set one
// guest's own cap (Manage › Guests); the page states the plan's.
export const FREE_RESERVATIONS_PER_MONTH = 2;
export const PRO_RESERVATIONS_PER_MONTH = 10;
export const PRO_PRICE_CENTS = 100;
