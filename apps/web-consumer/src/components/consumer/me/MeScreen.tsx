"use client";

import type { ComponentProps } from "react";
import { Screen } from "@/components/consumer/nav/Screen";

// Every Me page's frame is the app's one pushed-page frame (MESITA-3647),
// ON WHITE (MESITA-4000, Pato 2026-11-14: "use a white background, not gray
// … all me subpages"): `paper` paints the ground and header white, and
// `scrolls` because a Me page is a list that may run long (the overflow
// watch is for the pay screens that must fit).
export function MeScreen(props: ComponentProps<typeof Screen>) {
  return <Screen paper scrolls {...props} />;
}
