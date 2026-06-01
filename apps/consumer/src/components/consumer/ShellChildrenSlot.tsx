"use client";

// Keep shell content mounted while modal routes load and animate.
// UX requirement: opening venue info should layer on top of the current
// screen, not replace/unmount the underlying surface.

export function ShellChildrenSlot({ children }: { children: React.ReactNode }) {
  return <div className="contents">{children}</div>;
}
