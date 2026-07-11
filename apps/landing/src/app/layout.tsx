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
    default: "Mesita — descubre, reserva y paga menos",
    template: "%s · Mesita",
  },
  description:
    "Descubre, reserva y consigue descuentos reales en restaurantes, cafés, bares y antros. Hecho en Monterrey.",
  openGraph: {
    title: "Mesita — descubre, reserva y paga menos",
    description:
      "Descubre, reserva y consigue descuentos reales en restaurantes, cafés y bares.",
    siteName: "Mesita",
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mesita",
    description: "Descubre. Reserva. Paga menos cada vez.",
  },
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
