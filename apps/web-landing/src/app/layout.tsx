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
  "Mesita is the app for going out. Find a place, book a table and save by paying ahead. For restaurants: get discovered, bring guests back and get paid before the meal. Launching in Monterrey.";

export const metadata: Metadata = {
  metadataBase: new URL("https://landing.mesita.ai"),
  title: {
    default: "Mesita — the app for going out",
    template: "%s · Mesita",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "Mesita — the app for going out",
    description: DESCRIPTION,
    siteName: "Mesita",
    locale: "en_US",
    type: "website",
    url: "https://landing.mesita.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mesita — the app for going out",
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
