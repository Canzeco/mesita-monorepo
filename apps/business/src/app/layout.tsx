import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SuperAdminBanner } from "@/components/business/SuperAdminBanner";
import { createServerSupabase } from "@/lib/supabase/server";
import { getWhoami } from "@/lib/api/whoami";
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

// Resolve the global super-admin flag once per request. Failures are
// swallowed and treated as "not a super-admin" so the layout never
// gates rendering on an EF round-trip — the banner is informational,
// the real authorization lives in each EF.
async function checkSuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const result = await getWhoami(supabase);
    return result.isSuperAdmin === true;
  } catch {
    return false;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isSuperAdmin = await checkSuperAdmin();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Sticky so it stays visible while sub-route layouts scroll
            their own content beneath it. */}
        {isSuperAdmin && (
          <div className="sticky top-0 z-50">
            <SuperAdminBanner />
          </div>
        )}
        {children}
        {/* Sonner toaster — surfaces via toast() / toast.success() etc.
            from anywhere in the tree. Tucked at the body root so
            stacking context is predictable. */}
        <Toaster richColors closeButton position="bottom-center" />
      </body>
    </html>
  );
}
