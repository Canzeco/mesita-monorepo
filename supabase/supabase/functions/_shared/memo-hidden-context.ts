import { localMoment } from "./memo-local-moment.ts";

// The location + local time (+ signed-in/mock profile) Memo reasons over but
// must NOT recite. Assembles the same hidden-context clause the legacy
// pipeline built inline; buildAgentSystemPrompt wraps it under a "never recite
// verbatim" header. Shared by the consumer concierge and the admin playground
// so both feed Memo an identical moment.
export function buildHiddenMemoContext(
  profileCtx: string | null,
  lat: number | null,
  lng: number | null,
): string | null {
  const { clock, daypart } = localMoment(lng);
  const bits: string[] = [];
  if (profileCtx) bits.push(profileCtx);
  if (lat !== null && lng !== null) {
    bits.push(`near latitude ${lat.toFixed(4)}, longitude ${lng.toFixed(4)}`);
  }
  if (clock) bits.push(`local time ${clock} (${daypart})`);
  return bits.length > 0
    ? `The user is ${bits.join("; ")}. Favour places open and appropriate for this time of day.`
    : null;
}
