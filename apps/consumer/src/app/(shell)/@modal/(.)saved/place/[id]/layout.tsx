import { SlideOverShell } from "@/components/consumer/overlay/SlideOverShell";

// Mounts the sliding panel ONCE for this intercepted segment: the layout
// survives the loading.tsx → page.tsx swap, so the right-to-left slide plays
// a single time while the skeleton resolves to content inside it.
export default function ModalSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SlideOverShell>{children}</SlideOverShell>;
}
