"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** On the full site, a way into the phone emulator. The emulator labels itself. */
export function SurfaceSwitch() {
  const [web, setWeb] = useState(false);
  useEffect(() => {
    setWeb(document.documentElement.dataset.surface !== "mob");
  }, []);
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
