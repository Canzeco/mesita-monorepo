// mesita.ai/check/<code> — the public check page (Tickets v2, MESITA-806).
//
// This URL is what every ticket QR encodes. ANYONE who scans it lands here,
// no login: the page proves the ticket is a real, live Mesita check on the
// official domain, and gives staff the three actions of the visit — enter
// the bill, approve a submitted story/review, confirm payment. Staff-facing,
// so the copy is Spanish (es-MX) like the rest of the landing.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchCheck } from "@/lib/check-api";
import { CheckClient } from "@/components/check/CheckClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check Mesita",
  description: "Verificación oficial de tickets Mesita.",
  robots: { index: false, follow: false },
};

export default async function CheckPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const res = await fetchCheck(code);
  if (!res.ok || !("check" in res)) notFound();

  return (
    <main className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <CheckClient code={code} initial={res.check} />
      </div>
    </main>
  );
}
