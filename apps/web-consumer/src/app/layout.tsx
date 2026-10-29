import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { DeploymentWatcher } from "@/components/consumer/DeploymentWatcher";
import { ErrorNotifier } from "@/components/consumer/ErrorNotifier";
import { RouteBadge } from "@/components/consumer/RouteBadge";
import { ViewportLock } from "@/components/consumer/ViewportLock";
import { SHARE_CARD } from "@/lib/share-app";

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

// What the First Stage is (MESITA-2087): the city's catalog, the engines that
// surface a place, and the agent that books it. The copy promises only what
// the app does.
export const metadata: Metadata = {
  metadataBase: new URL("https://consumer.mesita.ai"),
  title: {
    default: "Mesita — discover and reserve",
    template: "%s · Mesita",
  },
  description:
    "Discover restaurants, cafés and bars across the city, and reserve a table in seconds. Made in Monterrey.",
  openGraph: {
    title: "Mesita — discover and reserve",
    description:
      "Discover restaurants, cafés and bars across the city, and reserve a table in seconds.",
    siteName: "Mesita",
    locale: "en_US",
    type: "website",
    // THE MESITA SHARE CARD (MESITA-2639): every shared link unfurls with
    // it; the Share tab shows the same file. A static .png under public/,
    // so signed-out crawlers reach it past the proxy's matcher. Source and
    // re-render command: scripts/share-card/mesita-og.html.
    images: [
      {
        url: SHARE_CARD.src,
        width: SHARE_CARD.width,
        height: SHARE_CARD.height,
        alt: SHARE_CARD.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mesita",
    description: "Discover. Reserve. Go out.",
    images: [SHARE_CARD.src],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const bare = (await headers()).get("x-pathname") ?? "/";
  // /onboard draws its own MobileFrame, so wrapping it here stacked two
  // emulators with two banners (Bugbot, PR #1995). /gift left with the First
  // Stage cut. Sign-in draws inside the phone card (MESITA-2137).
  const preShell = bare === "/" || bare.startsWith("/auth");
  const body = preShell ? <MobileFrame>{children}</MobileFrame> : children;
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="bg-background text-foreground flex h-full flex-col">
        {body}
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
        {/* Any error nothing caught is said as a notification (MESITA-3021). */}
        <ErrorNotifier />
        {/* The consumer shell mounts its own <Toaster /> (see
            src/components/consumer/Toaster.tsx + src/lib/toast.ts) so the
            toaster surfaces inside the mobile-frame stacking context,
            above the bottom nav. No root-level toaster is needed. */}
      </body>
    </html>
  );
}
