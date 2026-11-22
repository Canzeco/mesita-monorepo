"use client";

import {
  ConnectCardSkeleton,
  ConnectedAccount,
  WhyConnect,
} from "@/components/consumer/me/InstagramModal";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { useConsumerIdentity } from "@/lib/identity-context";

// /me/instagram's fallback: InstagramModal as it first paints (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes").
//
// A CLIENT MODULE FOR THE IDENTITY: the page is two pages — the connect card for a
// guest with no Instagram, the account card for one with — and only the
// shell's identity context says which. It is seeded server-side, so the
// right one is drawn from the first frame, and the account card itself
// (handle, Verified) is drawn for real: it reads nothing else.
//
//   not connected   Why connect, the Connect card's silhouette (the same
//                   one the page draws while it asks how connecting works
//                   today), then Photo's switch row
//   connected       the account card, Why connect, Photo's switch row,
//                   Disconnect in the account card's row (MESITA-4350)
//
// THE WORDS ARE THE PAGE'S: the intro, the account card and the
// Connect card are InstagramModal's own components, and the switch rows'
// words are switch-words.ts, the rows' first paint (on, before the read
// lands), drawn as themselves so they wrap where the rows' do.
export function InstagramSkeleton() {
  const { igConnected: connected } = useConsumerIdentity();

  return (
    <MeScreen title="Instagram">

      <div className="flex flex-col gap-4">
        {connected && <ConnectedAccount pending />}
        <WhyConnect live={false} />
        {!connected && <ConnectCardSkeleton />}

      </div>
      <p role="status" className="sr-only">
        Loading Instagram
      </p>
    </MeScreen>
  );
}
