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

// `robots: noindex, nofollow` IS LOAD-BEARING NOW (MESITA-1903). The app is
// deployed and publicly reachable, so this is one of the two things keeping a
// mock of the business console out of a search result — the other is the MOCK
// strip in `AppShell`. Do not remove either without the other's job being
// covered.
//
// Still no `metadataBase` and no Open Graph card: the link is passed to people
// who are told what it is, and a share card would make a mock look like a
// product announcement.
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
