import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { DeploymentWatcher } from "@/components/consumer/DeploymentWatcher";
import { RouteBadge } from "@/components/consumer/RouteBadge";
import { ViewportLock } from "@/components/consumer/ViewportLock";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

// THE KEYBOARD MUST SHRINK THE PAGE, not sit on top of it. `MobileFrame` is
// `h-dvh` with `BottomNav` as a flow child, so anything anchored to the bottom
// — the tab bar, the map's results panel, a sticky footer — lands underneath
// the keyboard the moment the layout viewport stops matching the visible one.
//
// `resizes-content` makes Chrome/Android shrink the layout viewport itself, so
// dvh and bottom-0 stay honest with no JS at all. Safari ignores it, which is
// what `useKeyboardInset` is for; the two compose, they do not double up.
//
// THE SURFACE IS A FIXED FRAME AND IT IS ALWAYS AT 100%. This is a phone-shaped
// visualizer, not a document: every screen is already sized to the viewport by
// `MobileFrame`, so a zoom level other than 1 can only ever crop it. Pinned
// here, it holds on Chrome/Android and on desktop.
//
// iOS Safari has ignored `user-scalable` and `maximum-scale` for PINCH since
// iOS 10 — deliberately, so a page can never take zoom away from a guest who
// needs it. The other two thirds of the lock live where Safari does listen:
// `ViewportLock` refuses Safari's own gesture events, and globals.css floors
// form controls at 16px so focusing a field cannot trigger the auto-zoom that
// caused this (a 14px `text-sm` input zoomed the whole app and left the tab
// row bleeding off both edges).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://consumer.mesita.ai"),
  title: {
    default: "Mesita — smart hospitality rewards",
    template: "%s · Mesita",
  },
  description:
    "Discover, reserve, and get an instant discount at restaurants, cafés, and bars. Made in Monterrey.",
  openGraph: {
    title: "Mesita — smart hospitality rewards",
    description:
      "Discover, reserve, and get an instant discount at restaurants, cafés, and bars.",
    siteName: "Mesita",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mesita",
    description: "Discover. Reserve. Save every time you go out.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="bg-background text-foreground flex h-full flex-col">
        {children}
        {/* The route, printed into the body — the preview panes and
            screenshot harnesses we QA in have no address bar. Mounted at
            the root so it covers every surface, shell and pre-auth alike. */}
        <RouteBadge />
        {/* The imperative half of the 100%-only lock: Safari ignores the
            viewport meta for pinch, but it does honour a refused
            gesturestart. See the viewport export above. */}
        <ViewportLock />
        {/* Self-refresh an open session when a newer production build ships,
            so merged changes actually appear without a manual hard reload. */}
        <DeploymentWatcher />
        {/* The consumer shell mounts its own <Toaster /> (see
            src/components/consumer/Toaster.tsx + src/lib/toast.ts) so the
            toaster surfaces inside the mobile-frame stacking context,
            above the bottom nav. No root-level toaster is needed. */}
      </body>
    </html>
  );
}
