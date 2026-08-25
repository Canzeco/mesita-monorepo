// check.mesita.ai/<code> — the public check page (Tickets v2/v3, MESITA-806/814).
//
// This URL is what every ticket QR encodes. ANYONE who scans it lands here,
// no login: the page proves the ticket is a real, live Mesita check on the
// official domain, and gives staff the visit actions — enter the bill
// (optional unless the place requires it) and mark paid / close the ticket.
// Story and review rows are informational only (MESITA-849); staff never
// approve or reject. Staff-facing, so the copy is Spanish (es-MX).

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchCheck } from "@/lib/check-api";
import { CheckClient } from "@/components/check/CheckClient";
import { CheckUnavailable } from "@/components/check/CheckUnavailable";

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

  if (!res.ok) {
    // 404 is the ONLY answer that means "this code is not a check" — the EF
    // returns a uniform miss for unknown, malformed and purged codes alike.
    // Anything else (429, 5xx, an unreachable network) is our problem, not
    // the guest's, and must not be shown as a failed verification.
    if (res.status === 404) notFound();
    return (
      <main className="bg-background min-h-dvh px-4 py-8">
        <div className="mx-auto w-full max-w-md">
          <CheckUnavailable status={res.status} />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background min-h-dvh px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <CheckClient code={code} initial={res.check} />
      </div>
    </main>
  );
}
