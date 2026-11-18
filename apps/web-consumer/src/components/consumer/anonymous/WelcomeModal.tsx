"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { PhotoSignCard } from "./PhotoSignCard";
import { VALUE_LINE } from "@/components/auth/CoverAuthLayout";
import { useViewer } from "@/lib/identity-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// THE WELCOME (MESITA-4246, Pato 2026-11-17: "un modal que flota sobre Home
// y te dice como usuario anónimo o este, regístrate ... y que te salga la
// propuesta de valor"). Over Home, to an anonymous visitor only. Create
// account goes to Sign; Just browse or the close leaves Home as it
// is. The flag is read through useSyncExternalStore (no setState in an
// effect); the server snapshot is "answered", so SSR never paints it.
//
// THE MONTERREY COVER (Pato, 2026-11-17, MESITA-4284: "use the monterrey
// background in thism modal. that modal looks like shit"; /plan-design-review,
// "Photo fills the card"): the card IS the sign-in cover photo (the terrace
// under the Cerro de la Silla, CoverAuthLayout's), 4:5, full bleed, no blur
// (MESITA-3746). A veil at the top holds the mark and the wordmark, a deep
// fade at the bottom holds the copy in white, the green Continue with phone
// (MESITA-4287; a white Create account before) and Explore anonymously in
// white text.
//
// SIGN IN, NO METHOD (Pato, 2026-11-18, MESITA-4317: "continue with phone
// here just look weird. maybe login or sign … don't mention the method
// yet"; picked "Sign in / Not now"): the cover's value line (VALUE_LINE), a white Sign in and a
// plain second way, now Just browse (MESITA-4328). The phone comes up on the Sign page, not here.
// The wordmark as the header and the sign-in cover write it (MESITA-3653).
const listeners = new Set<() => void>();

// EVERY PAGE LOAD (Pato, 2026-11-17, MESITA-4285: "when i reload page as an
// not user, redirect the home and first show the modal and ask the
// question"; /autoplan, gate answered rec): the answer lives in memory, not
// on the device, so every full load or new visit asks again until the guest
// has an account. Just browse or the backdrop closes it for this load
// only; in-app tab taps keep the module alive and never bring it back. It
// was once per device (localStorage) before. Browsing without an account creates no
// Supabase session: there is none for anonymous visitors (MESITA-2137).
let answered = false;

function seen(): boolean {
  return answered;
}

function markSeen(): void {
  answered = true;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function WelcomeModal() {
  const viewer = useViewer();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const alreadySeen = useSyncExternalStore(subscribe, seen, () => true);
  const open =
    viewer === "anonymous" && !alreadySeen && pathname.startsWith("/home");
  return (
    <LocalDialog open={open} onClose={markSeen} ariaLabel="Welcome to Mesita">
      {/* The shared photo card (PhotoSignCard, MESITA-4338). "Just browse"
          (MESITA-4328): "Not now" (MESITA-4317) said nothing, "Explore
          anonymously" (MESITA-4287) sounded like hiding, "as guest" is out
          because a Mesita guest is a signed-in diner. */}
      <PhotoSignCard
        title="Discover your next favorite place."
        line={VALUE_LINE}
        onSignIn={() => {
          markSeen();
          router.push(CONSUMER_ROUTES.sign);
        }}
        secondLabel="Just browse"
        onSecond={markSeen}
      />
    </LocalDialog>
  );
}
