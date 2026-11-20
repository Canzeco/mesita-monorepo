"use client";

import { Suspense } from "react";

import { PersonProfile } from "@/components/consumer/home/SocialFeed";

// A member's card (MESITA-4113). The query is the event — person, kind, at —
// because the feed names the member and never stores an id (MESITA-2460).
export default function PersonProfilePage() {
  return (
    <Suspense>
      <PersonProfile />
    </Suspense>
  );
}
