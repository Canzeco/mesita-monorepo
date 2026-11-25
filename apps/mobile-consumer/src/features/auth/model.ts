// Pure rules: who is looking, and which gate the app is in.

export type Gate = "starting" | "update" | "suspended" | "onboarding" | "open";

export type Profile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  sex: string | null;
  birthYear: number | null;
  phone: string | null;
  isVip: boolean;
};

export type Session = {
  /** The device's own storage has answered, or took too long. */
  settled: boolean;
  guestId: string | null;
  updateRequired: boolean;
  /** The server's sentence. */
  suspended: string | null;
  /** What sign-in said: false until the profile saves. */
  onboarded: boolean;
  /** Said once on sign-in: "You were signed out. Sign in again." */
  notice: string | null;
  /** Development and preview only. */
  forced: Gate | null;
};

export const SIGNED_OUT: Session = {
  settled: false,
  guestId: null,
  updateRequired: false,
  suspended: null,
  onboarded: true,
  notice: null,
  forced: null,
};

const SEXES = ["male", "female", "other"];

/** The same predicate as the backend's `isOnboarded`. */
export function isComplete(p: Profile): boolean {
  return !!p.firstName?.trim() && !!p.lastName?.trim() && p.birthYear !== null && SEXES.includes(p.sex ?? "");
}

/** `profile` is undefined until one was read: a failed read is never a reason
 *  to ask for onboarding. */
export function gateOf(s: Session, profile: Profile | undefined): Gate {
  if (!s.settled) return "starting";
  if (s.forced) return s.forced;
  if (s.updateRequired) return "update";
  if (s.suspended !== null) return "suspended";
  if (s.guestId && (profile ? !isComplete(profile) : !s.onboarded)) return "onboarding";
  return "open";
}

export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 60;

/** The number as Auth wants it, or null when it cannot be one. Every send is
 *  a text Mesita pays for. */
export function toE164(typed: string): string | null {
  const digits = typed.replace(/\D/g, "");
  if (!typed.trim().startsWith("+") || digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  if (digits.startsWith("52") && digits.length !== 12) return null;
  if (digits.startsWith("1") && digits.length !== 11) return null;
  return `+${digits}`;
}

/** A wrong and an expired code share one message: Auth answers the same. */
export function authMessage(err: { code?: string; status?: number; message?: string; name?: string }): string {
  const text = err.message ?? "";
  if (err.code === "over_sms_send_rate_limit") return "A code was just sent. Wait a minute and ask again.";
  if (err.code === "over_request_rate_limit" || err.status === 429) {
    return "Too many tries. Wait a few minutes and try again.";
  }
  if (err.code === "otp_expired" || /token|otp/i.test(text)) {
    return "That code isn't right or has expired. Check it or ask for a new one.";
  }
  if (err.name === "AuthRetryableFetchError" || /network/i.test(text)) return "No connection.";
  if (err.code === "sms_send_failed" || err.code === "validation_failed") {
    return "We couldn't send the code. Check the number and try again.";
  }
  if (err.code === "otp_disabled") return "Phone sign-in is unavailable right now. Try again shortly.";
  return "Something went wrong. Try again.";
}

export const HEADLINE = "Discover your next favorite place.";
export const VALUE_LINE = "Discovery, reservations, discounts and gifts at restaurants, cafés and bars.";
