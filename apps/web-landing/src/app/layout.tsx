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

const DESCRIPTION =
  "Every restaurant, café, bar and club in the city, found your way and booked by an agent that makes the call. For places, a profile that already exists, ready to claim. Launching in Monterrey.";

export const metadata: Metadata = {
  metadataBase: new URL("https://landing.mesita.ai"),
  title: {
    default: "Mesita — where are we going?",
    template: "%s · Mesita",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "Mesita — where are we going?",
    description: DESCRIPTION,
    siteName: "Mesita",
    locale: "en_US",
    type: "website",
    url: "https://landing.mesita.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mesita — where are we going?",
    description: DESCRIPTION,
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
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
