"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function surfaceIsWeb() {
  return document.documentElement.dataset.surface !== "mob";
}

/** On the full site, a way into the phone emulator. The emulator labels itself. */
export function SurfaceSwitch() {
  const web = useSyncExternalStore(subscribe, surfaceIsWeb, () => false);
  if (!web) return null;
  return (
    <p className="type-meta text-muted-foreground mt-3">
      The full site is browse-only — no sign-up here.{" "}
      <Link href="/mob" className="text-primary font-medium">
        Phone emulator
      </Link>
      {" · "}
      <a href="https://mesita.ai" className="text-primary font-medium">
        Get the app to sign in
      </a>
    </p>
  );
}
