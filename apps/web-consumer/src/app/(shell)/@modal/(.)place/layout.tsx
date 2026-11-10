import { SlideOverShell } from "@/components/consumer/overlay/SlideOverShell";

// Mounts the sliding panel ONCE for every intercepted place route: the layout
// survives the loading.tsx → page.tsx swap, so the right-to-left slide plays
// a single time while the skeleton resolves to content inside it. It sits
// above [id] and open/[gid] so the opening screen of a Google place swaps to
// its profile inside the same panel, without sliding in twice (MESITA-2311).
//
// THE BAR HIDES WHILE A PROFILE IS OPEN (Pato, MESITA-3300: "when seeing a
// profile, you must hide the bottom menu"), the skeleton and the generating
// view included: ROUTE_MAP's `bar: false` on the place rows (MESITA-3646).
// The reservation slide-over keeps the bar.
export default function ModalSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SlideOverShell>{children}</SlideOverShell>;
}
