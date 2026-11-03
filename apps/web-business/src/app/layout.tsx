import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { DeploymentWatcher } from "@/components/shell/DeploymentWatcher";
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
  title: { default: "Mesita", template: "%s · Mesita" },
  description: "Run your place's Mesita profile and Premier.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full">
        {children}
        <DeploymentWatcher />
      </body>
    </html>
  );
}
