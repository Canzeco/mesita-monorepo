import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

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
  metadataBase: new URL("https://mesita.ai"),
  title: {
    default: "Mesita — smart hospitality wallet",
    template: "%s · Mesita",
  },
  description:
    "Discover, reserve, and earn real cashback at restaurants, cafés, and bars. Made in Monterrey.",
  openGraph: {
    title: "Mesita — smart hospitality wallet",
    description:
      "Discover, reserve, and earn real cashback at restaurants, cafés, and bars.",
    siteName: "Mesita",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mesita",
    description: "Discover. Reserve. Get paid to go out.",
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
      <body className="bg-background text-foreground flex min-h-full flex-col">
        {children}
        {/* The consumer shell mounts its own <Toaster /> (see
            src/components/consumer/Toaster.tsx + src/lib/toast.ts) so the
            toaster surfaces inside the mobile-frame stacking context,
            above the bottom nav. No root-level toaster is needed. */}
      </body>
    </html>
  );
}
