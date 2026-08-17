import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { DeploymentWatcher } from "@/components/consumer/DeploymentWatcher";
import { RouteBadge } from "@/components/consumer/RouteBadge";

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
