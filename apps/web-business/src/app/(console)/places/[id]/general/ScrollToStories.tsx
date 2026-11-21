"use client";

// A story link lands on General with ?story= (MESITA-4538). A hash after a
// redirect is not reliable in the App Router, so the section scrolls itself.
import { useEffect } from "react";

export function ScrollToStories() {
  useEffect(() => {
    document.getElementById("stories")?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
