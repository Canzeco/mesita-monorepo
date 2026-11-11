"use client";

// The Staff QR (MESITA-3696). A waiter scans it once per shift with the
// phone's camera: visit.mesita.ai/staff/<place>#<secret> signs that phone in
// for 12 hours, so a guest's QR goes straight to the bill with no waiter code
// typed. The owner prints it or sends it on WhatsApp; New Staff QR replaces
// it, and the old printout and every signed-in phone stop working. It needs
// the waiter code first. Only the owner and Mesita staff see it (the server
// sends no secret to an editor).

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCodeIcon } from "@phosphor-icons/react/dist/ssr";
import { makeStaffQr, type StaffQr } from "@/lib/business-api";
import { cn } from "@/lib/utils";

const QUIET =
  "border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** The Staff QR row: one <li> of the Cash Payments list. */
export function StaffQrRow({
  placeId,
  visitOrigin,
  codeSet,
  canEdit,
  initial,
  onError,
}: {
  placeId: string;
  visitOrigin: string;
  codeSet: boolean;
  canEdit: boolean;
  initial: StaffQr | null;
  onError: (error: string | null) => void;
}) {
  const [qr, setQr] = useState<StaffQr | null>(initial);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const svgBox = useRef<HTMLDivElement>(null);
  const url = qr ? `${visitOrigin}/staff/${encodeURIComponent(placeId)}#${qr.secret}` : null;
  const name = qr?.place_name ?? "your place";

  async function make() {
    setBusy(true);
    setConfirming(false);
    onError(null);
    const r = await makeStaffQr(placeId);
    setBusy(false);
    if (!r.ok) return onError(r.error);
    setQr(r.data);
  }

  function print() {
    const svg = svgBox.current?.querySelector("svg")?.outerHTML;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!svg || !w) return;
    const title = `Staff QR · ${name}`.replace(/[<>&]/g, "");
    w.document.write(
      `<!doctype html><title>${title}</title><body style="font-family:system-ui;text-align:center;padding:32px">` +
        `<h1 style="font-size:24px;margin:0 0 4px">${title.replace("Staff QR · ", "")}</h1>` +
        `<p style="font-size:16px;margin:0 0 24px">Waiters: scan once per shift with your phone's camera.</p>` +
        `<div style="width:320px;margin:0 auto">${svg.replace(/width="\d+" height="\d+"/, 'width="320" height="320"')}</div>` +
        `<p style="font-size:13px;color:#525252;margin-top:24px">Keep this where only staff can see it.</p></body>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  const whatsapp = url ? `https://wa.me/?text=${encodeURIComponent(`Staff QR for ${name}. Open it on your phone once per shift: ${url}`)}` : null;

  return (
    <li id="staff-qr" className="flex scroll-mt-24 flex-wrap items-start gap-4 px-5 py-3 text-sm sm:px-6" data-place-state="staff_qr">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", qr ? "bg-lime-100 text-lime-700" : "bg-muted text-muted-foreground")}>
        <QrCodeIcon size={22} weight={qr ? "fill" : "regular"} aria-hidden />
      </span>
      <div className="min-w-48 flex-1">
        <p className="font-medium">Staff QR</p>
        <p className="text-muted-foreground">
          {!codeSet
            ? "Set the waiter code first."
            : !canEdit && !qr
              ? "The owner makes and prints it."
              : "Waiters scan it once per shift. Their phone is signed in for 12 hours, no code typed."}
        </p>
        {qr ? (
          <p className="text-muted-foreground mt-1" data-staff-qr-used>
            {qr.used_at ? `Last used ${when(qr.used_at)}` : "Not used yet"} · Made {when(qr.made_at)}
          </p>
        ) : null}
        {url ? (
          <div ref={svgBox} className="mt-3 w-fit rounded-xl border bg-white p-3">
            <QRCodeSVG value={url} size={160} marginSize={0} title={`Staff QR for ${name}`} />
          </div>
        ) : null}
      </div>
      {codeSet && canEdit ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {qr ? (
            <>
              <button type="button" className={QUIET} onClick={print}>
                Print
              </button>
              <a className={cn(QUIET, "inline-flex items-center")} href={whatsapp ?? undefined} target="_blank" rel="noreferrer">
                Share on WhatsApp
              </a>
              {confirming ? (
                <button type="button" className={cn(QUIET, "border-red-300 text-red-700")} disabled={busy} onClick={() => void make()}>
                  {busy ? "Making…" : "Yes, old one stops working"}
                </button>
              ) : (
                <button type="button" className={QUIET} disabled={busy} onClick={() => setConfirming(true)}>
                  New Staff QR
                </button>
              )}
            </>
          ) : (
            <button type="button" className={QUIET} disabled={busy} onClick={() => void make()}>
              {busy ? "Making…" : "Make Staff QR"}
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}
