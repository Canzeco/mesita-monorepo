// THE PARTNER BADGE, DERIVED ONCE (MESITA-2017).
//
// Pato, 2026-09-20: Mesita Partner is a product with a CHECKLIST, and the
// badge is what completing it grants. Five rows, in the order a new place
// meets them:
//
//   1. Verified              somebody at Mesita confirmed the place is real
//   2. Profile complete      name, address, hours, at least one photo
//   3. Visit Rewards on      the guest can earn something here
//   4. Online Payments on    the guest can pay here (Stripe enabled)
//   5. A paid plan           Start or above — the rung that carries the badge
//
// ONE READER. `MockPlace.partnered` is the LADDER's fact (`plan !== "free"`,
// derived in `scenario.ts`) and half the app reads it; this function is the
// CHECKLIST's fact. They are not the same fact and the test that pins them
// says which way the implication runs: a badge is never held without a paid
// rung, while a paid rung alone does not hold the badge.
//
// WHAT REMOVES IT. Only the plan lapsing or Verified being revoked — rows 5
// and 1. Rows 2–4 BLOCK EARNING the badge and, on a place that already holds
// it, read "at risk": an operator who pauses Rewards for a holiday must not
// watch their badge vanish from a guest's map that evening. `partnerLapsedAt`
// is the fixture's memory of the last removal, so the card can say when.
import { type MockPlace, type MockPlaceProfile, planAtLeast } from "@/mock/types";

export type PartnerCheckKey = "verified" | "profile" | "rewards" | "payments" | "plan";

export type PartnerCheck = {
  key: PartnerCheckKey;
  label: string;
  /** What to do when it fails — imperative, and where. */
  fix: string;
  done: boolean;
  /** Rows 1 and 5 remove a held badge when they fail; the others only block. */
  removes: boolean;
};

export function profileComplete(profile: MockPlaceProfile | undefined): boolean {
  if (!profile) return false;
  const name = (profile.mesita_name ?? profile.google_name ?? "").trim();
  return (
    name.length > 0 &&
    (profile.address ?? "").trim().length > 0 &&
    profile.hours !== null &&
    profile.photos.length > 0
  );
}

export function partnerChecks(
  place: MockPlace,
  profile: MockPlaceProfile | undefined,
): PartnerCheck[] {
  return [
    {
      key: "verified",
      label: "Verified",
      fix: "Ask for verification on Mesita Profile",
      done: place.verified,
      removes: true,
    },
    {
      key: "profile",
      label: "Profile complete",
      fix: "Name, address, hours and a photo on Mesita Profile",
      done: profileComplete(profile),
      removes: false,
    },
    {
      key: "rewards",
      label: "Visit Rewards on",
      fix: "Turn the program on in Visit Rewards",
      done: place.visitRewards,
      removes: false,
    },
    {
      key: "payments",
      label: "Online Payments on",
      fix: "Finish the Stripe account in Online Payments",
      done: place.pay === "enabled",
      removes: false,
    },
    {
      key: "plan",
      label: "A paid plan",
      fix: "Any rung from Mesita Start up",
      done: planAtLeast(place.plan, "start"),
      removes: true,
    },
  ];
}

export type PartnerStatus = {
  /** Held right now: every row done. */
  badge: boolean;
  /** Held and one of rows 2–4 has since failed. Never true with `badge`
   *  false: a badge that is not held cannot be at risk. */
  atRisk: boolean;
  done: number;
  failing: PartnerCheck[];
};

export function partnerStatus(
  place: MockPlace,
  profile: MockPlaceProfile | undefined,
): PartnerStatus {
  const checks = partnerChecks(place, profile);
  const failing = checks.filter((c) => !c.done);
  const removed = failing.some((c) => c.removes);
  // The badge survives a blocking row failing, but only if it was ever
  // earned: a place that has never had rows 2–4 all green has nothing to keep.
  const held = !removed && (failing.length === 0 || place.partnerHeld);
  return {
    badge: held,
    atRisk: held && failing.length > 0,
    done: checks.length - failing.length,
    failing,
  };
}
