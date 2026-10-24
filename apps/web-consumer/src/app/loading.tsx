import { headers } from "next/headers";

import { BottomNav } from "@/components/consumer/BottomNav";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { LoadingFill } from "@/components/shared";
import SearchChatLoading from "./(shell)/(discovery)/search/chat/loading";
import SearchLoading from "./(shell)/(discovery)/search/loading";

// The wait before a route's own loading.tsx can mount: the shell layout is
// async (the session and the profile), so this file is what a hard load
// paints first. It used to be a full-viewport gradient with a spinner in
// the middle of the browser. On the desktop phone that splash sits outside
// the card, and on sign-in — where the root layout already drew the phone —
// `min-h-dvh` is taller than the card, so the spinner is not in the phone.
//
// The phone is the loading screen (Pato, MESITA-2750). Sign-in is already
// inside one. Onboard draws its own and has no tab bar. Every shell route
// gets the card and the real bottom bar, and Search gets Search's skeleton
// so the map does not arrive as a second, different screen.

function shellChrome(body: React.ReactNode) {
  return (
    <MobileFrame>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
      <BottomNav />
    </MobileFrame>
  );
}

function fill() {
  return (
    <LoadingFill className="bg-background" label="Loading Mesita" size="lg" />
  );
}

export default async function RootLoading() {
  const bare = (await headers()).get("x-bare-pathname") ?? "/";
  if (bare === "/" || bare.startsWith("/auth")) return fill();
  if (bare === "/onboard" || bare.startsWith("/onboard/")) {
    return <MobileFrame>{fill()}</MobileFrame>;
  }
  if (bare === "/search/chat" || bare.startsWith("/search/chat/")) {
    return shellChrome(<SearchChatLoading />);
  }
  if (bare === "/search" || bare.startsWith("/search/")) {
    return shellChrome(<SearchLoading />);
  }
  return shellChrome(fill());
}
