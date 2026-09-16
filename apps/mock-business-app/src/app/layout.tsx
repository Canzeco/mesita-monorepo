import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

// NO `metadataBase`, and no Open Graph card. This app is never served on a
// domain, never linked to and never crawled; a share card for a mock console is
// a share card for something that does not exist.
export const metadata: Metadata = {
  title: { default: "Mock business console", template: "%s · Mock" },
  description: "A disconnected mock of the Mesita business console.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
