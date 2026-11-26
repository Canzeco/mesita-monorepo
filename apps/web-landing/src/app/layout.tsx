import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  // One family, Inter, headings included (Pato 2026-11-19; MESITA-4994).
  subsets: ["latin"],
  display: "swap",
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
