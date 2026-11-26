// MESITA-4393. Two facts the reserve form needs before it shows a count, a
// "No reservations left" notice or the Pro offer, so it never blocks or
// upsells a guest the server would treat differently:
//
//   cap_lifted   the admin testing switch app_config.reservations_config
//                .unlimitedReservations is on. consumer-web-create-reservation
//                reads the same key (its "Monthly reservation cap" block);
//                change the two together. plan-flags.test.ts pins both reads.
//   cap_override the guest has an operator cap (readCapOverride, exactly
//                what monthlyReservationCap enforces), so Pro would not
//                change their cap and must not be offered.
//   test_call    Who the agent calls is Test number or Guest's phone
//                (testCall.enabled). Production is enabled false. The reserve
//                form then adds its Test step (MESITA-5000).
//
// Only consumer-web-get-plan imports this file, so editing it redeploys
// that one function.

import { readCapOverride } from "./reservation-cap.ts";

export type PlanFlags = {
  cap_lifted: boolean;
  cap_override: boolean;
  test_call: boolean;
};

/** The flags, or null when the settings read failed: the caller then
 *  leaves them out of its reply and the web form fails open. */
export function planFlags(
  row: { reservation_cap_override?: unknown } | null | undefined,
  reservationsConfig: unknown,
  configReadFailed = false,
): PlanFlags | null {
  if (configReadFailed) return null;
  const cfg = reservationsConfig as {
    unlimitedReservations?: unknown;
    testCall?: { enabled?: unknown };
  } | null | undefined;
  return {
    cap_lifted: cfg?.unlimitedReservations === true,
    cap_override: readCapOverride(row?.reservation_cap_override) !== null,
    // Both testing modes set enabled; Production turns it off.
    test_call: cfg?.testCall?.enabled === true,
  };
}
