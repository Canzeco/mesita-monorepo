"use client";

import { useEffect, useSyncExternalStore } from "react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { PhotoSignCard } from "./PhotoSignCard";
import { useViewer } from "@/lib/identity-context";
import {
  closeSignGate,
  continueToSign,
  currentSignGate,
  openSignGate,
  subscribeSignGate,
  type SignGateReason,
} from "@/lib/anonymous";
import {
  isAtRoute,
  isOpenToAnonymous,
  shellRoots,
} from "@/lib/consumer-route-contract";

// SIGN IN FIRST, ASKED NOT FORCED (Pato, 2026-11-17, MESITA-4288: "i want to
// reserve, or to save a place, or to click an offer. show another
// specialized modal saying like you need to sign in to do this … display
// the modal before aggressively redirecting"). An anonymous visitor's gated
// tap opens this card instead of jumping to Sign:
//
//   - a call lib/anonymous.ts gates (Save, buy a voucher, a person, Ask…)
//     reaches requestSignIn, which opens it where the visitor stands;
//   - a tap on a link they cannot open (Reserve, Pay…) or on an offer
//     (`?rewards=`) is caught here before it navigates.
//
// The card says what the sign-in is for, then an ink Sign in and a grey Not
// now. Only Sign in goes to Sign, carrying `next` and a pending Save as
// before. It names no method (Pato, 2026-11-18, MESITA-4317: "don't mention
// the method yet"): it was a green Continue with phone.

const COPY: Record<
  SignGateReason,
  { title: string; line: string }
> = {
  save: {
    title: "Sign in to save places",
    line: "Keep the places you love in one list, on any phone.",
  },
  reserve: {
    title: "Sign in to book",
    line: "Reserve a table in a few taps.",
  },
  offers: {
    title: "Sign in to get this offer",
    line: "Buy credit at this place and get the bonus on top.",
  },
  pay: {
    title: "Sign in to pay",
    line: "Pay the bill from your phone at the table.",
  },
  social: {
    title: "Sign in to see people",
    line: "See who goes where and what they like.",
  },
  gift: {
    title: "Sign in to take your credit",
    line: "A friend sent you credit. Sign in to keep it.",
  },
  place: {
    title: "Sign in to save places",
    line: "Keep the places you love in one list, on any phone.",
  },
  plain: {
    title: "Sign in to continue",
    line: "Save places, book tables and get offers.",
  },
};

/** A link an anonymous visitor cannot follow, or an offer: ask first. */
function gatedTarget(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  const target = `${url.pathname}${url.search}`;
  if (url.searchParams.has("rewards")) return target;
  const inShell = shellRoots().some((root) => isAtRoute(url.pathname, root));
  if (inShell && !isOpenToAnonymous(url.pathname)) return target;
  return null;
}

export function SignGateModal() {
  const viewer = useViewer();
  const gate = useSyncExternalStore(
    subscribeSignGate,
    currentSignGate,
    () => null,
  );

  // Catch the tap in the capture phase, before Next's Link navigates.
  useEffect(() => {
    if (viewer !== "anonymous") return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const next = gatedTarget(a.getAttribute("href") ?? "");
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      openSignGate(next, null);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [viewer]);

  const open = viewer === "anonymous" && gate !== null;
  const copy = COPY[gate?.reason ?? "plain"];

  return (
    <LocalDialog open={open} onClose={closeSignGate} ariaLabel={copy.title}>
      {/* ON THE MOUNTAIN (Pato, 2026-11-18, MESITA-4338: "all the modals
          must display that stupid background of the mountain"): the
          welcome's photo card, the reason as its headline. A white card
          with an icon chip before. */}
      <PhotoSignCard
        title={copy.title}
        line={copy.line}
        onSignIn={() => {
          if (gate) continueToSign(gate);
        }}
        secondLabel="Not now"
        onSecond={closeSignGate}
      />
    </LocalDialog>
  );
}
