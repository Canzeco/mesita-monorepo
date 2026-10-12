// The guest's monthly reservation cap.
//
// Every reservation is a real, metered phone call to a place, so one guest
// gets MONTHLY_RESERVATION_CAP of them per calendar month (UTC); cancelled
// and test tickets do not count. It is an abuse guard: one number for every
// guest today. Premium (Soon, Me › Plan) is promised MORE reservations a
// month; when a subscription EF exists that lands here as a per-plan cap, and
// Me › Plan's FREE_RESERVATIONS_PER_MONTH follows it.
// app_config.reservations_config.unlimitedReservations lifts it for testing.
//
// web-consumer's ReservationSheet matches RESERVATION_LIMIT_CODE and prints
// its own copy of RESERVATION_LIMIT_MESSAGE; change the two together.
// reservation-cap.test.ts pins the number Me › Plan shows to the one below.

export const MONTHLY_RESERVATION_CAP = 10;

export const RESERVATION_LIMIT_CODE = "reservation_limit_reached";

export const RESERVATION_LIMIT_MESSAGE =
  "You've reached this month's reservation limit.";
