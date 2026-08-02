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

// Mesita Check — the staff-side app. The waiter scans the QR the guest
// generated in their app and lands on /check/<code>: proof the ticket is a
// real, live Mesita check, plus the actions of the visit (bill, approvals,
// payment). Staff-facing → Spanish (es-MX), never indexed.
export const metadata: Metadata = {
  metadataBase: new URL("https://check.mesita.ai"),
  title: {
    default: "Mesita Check",
    template: "%s · Mesita Check",
  },
  description: "Verificación y cobro oficial de tickets Mesita.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
