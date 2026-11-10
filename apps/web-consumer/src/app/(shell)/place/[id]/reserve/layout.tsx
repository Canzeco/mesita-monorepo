import { PageSlideIn } from "@/components/consumer/overlay/SlideOverShell";
import { placePath } from "@/lib/consumer-route-contract";

// The Reserve page slides in from the right like every panel (MESITA-3621).
// Mounted here, not in page.tsx, so the slide plays once while loading.tsx
// resolves to the page inside it.
export default async function PlaceReserveLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PageSlideIn fallbackHref={placePath(id)}>{children}</PageSlideIn>;
}
