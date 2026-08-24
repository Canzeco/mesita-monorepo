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
  "An AI-native platform for going out: discovery, AI reservations, commission-free pickup orders, rewards and payments in one app. In development — launching in San Francisco, January 2027.";

export const metadata: Metadata = {
  metadataBase: new URL("https://mesita.ai"),
  title: {
    default: "Mesita — where are we going tonight?",
    template: "%s · Mesita",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "Mesita — where are we going tonight?",
    description: DESCRIPTION,
    siteName: "Mesita",
    locale: "en_US",
    type: "website",
    url: "https://mesita.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mesita — where are we going tonight?",
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
