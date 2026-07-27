import { mexicoZone } from "./local-time.ts";

function daypartLabel(hour: number): string {
  if (hour < 5) return "the middle of the night";
  if (hour < 11) return "morning";
  if (hour < 15) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "late night";
}

// Current local clock + daypart for the user, e.g.
// { clock: "Monday, 5:12 AM", daypart: "the middle of the night" }.
export function localMoment(lng: number | null): {
  clock: string;
  daypart: string;
} {
  const timeZone = mexicoZone(lng);
  const now = new Date();
  let clock = "";
  let hour = 12;
  try {
    clock = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(now);
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(now);
    hour = parseInt(hourStr, 10) % 24;
  } catch {
    // Bad zone -> leave neutral midday defaults; never sink the answer over time.
  }
  return { clock, daypart: daypartLabel(hour) };
}
