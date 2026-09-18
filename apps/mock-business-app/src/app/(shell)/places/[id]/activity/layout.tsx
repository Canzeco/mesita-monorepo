"use client";

// ACTIVITY'S FRAME (MESITA-1986) — the SAME shell Setup uses, which is the
// symmetry: one index, one split, one set of scrollers, and the only
// difference is which half of a product the pane draws.
import { ProductShell } from "@/components/console/ProductShell";

export default function ActivityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProductShell half="activity">{children}</ProductShell>;
}
