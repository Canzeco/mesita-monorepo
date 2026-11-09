"use client";

// The table QR (MESITA-3382): one printable PNG per place, a QR to the
// guest's Pay form with this place preset (`mesita.ai/pay?place=<id>`, W2a's
// entry, MESITA-3304 rule 12) and the place's name under it. No table
// identity and no server call: the PNG is drawn here from the QR and the
// name. The guest's Pay page carries the address through sign-in and opens
// the form for this place, or says the place isn't taking Mesita Pay.

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { DownloadSimpleIcon, QrCodeIcon } from "@phosphor-icons/react/dist/ssr";
import { PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** The guest app's origin: the Pay tab lives on mesita.ai. */
const CONSUMER_ORIGIN = "https://mesita.ai";

export function payQrUrl(placeId: string): string {
  return `${CONSUMER_ORIGIN}/pay?place=${encodeURIComponent(placeId)}`;
}

/** A file name the owner recognises: the place's name, plain ASCII. */
function fileName(name: string | null): string {
  const slug = (name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `mesita-pay-${slug || "place"}.png`;
}

// The printed card: 4:5, white, the QR in the middle, the name under it.
const W = 1200;
const H = 1500;
const QR = 840;
const QR_PX = 1024;

/** Shrinks a line until it fits the card's width. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, max: number): void {
  let size = start;
  for (; size > 28; size -= 4) {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    if (ctx.measureText(text).width <= max) return;
  }
}

function drawCard(qr: HTMLCanvasElement, name: string | null, url: string): HTMLCanvasElement {
  const card = document.createElement("canvas");
  card.width = W;
  card.height = H;
  const ctx = card.getContext("2d");
  if (!ctx) return card;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#0a0a0a";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  fit(ctx, "Pay here with Mesita", 700, 72, W - 160);
  ctx.fillText("Pay here with Mesita", W / 2, 170);
  ctx.fillStyle = "#525252";
  fit(ctx, "Scan to pay the bill from your phone", 400, 40, W - 160);
  ctx.fillText("Scan to pay the bill from your phone", W / 2, 240);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, (W - QR) / 2, 300, QR, QR);
  ctx.fillStyle = "#0a0a0a";
  const title = name?.trim() || "Mesita";
  fit(ctx, title, 700, 64, W - 160);
  ctx.fillText(title, W / 2, 1270);
  ctx.fillStyle = "#737373";
  const shown = url.replace("https://", "");
  fit(ctx, shown, 400, 30, W - 160);
  ctx.fillText(shown, W / 2, 1340);
  return card;
}

export function TableQr({ placeId, placeName, live }: { placeId: string; placeName: string | null; live: boolean }) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const url = payQrUrl(placeId);

  function download() {
    setError(null);
    const qr = qrRef.current;
    if (!qr) return setError("The QR didn't draw. Reload the page and try again.");
    drawCard(qr, placeName, url).toBlob((blob) => {
      if (!blob) return setError("The QR didn't draw. Reload the page and try again.");
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName(placeName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    }, "image/png");
  }

  return (
    <li className="flex items-center gap-4 px-5 py-3 text-sm sm:px-6" data-table-qr>
      <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-black/5">
        <QRCodeCanvas
          ref={qrRef}
          value={url}
          size={QR_PX}
          marginSize={0}
          level="M"
          style={{ width: "100%", height: "100%" }}
          aria-label="Table QR"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium">
          <QrCodeIcon size={16} weight="bold" aria-hidden />
          Table QR
        </p>
        <p className="text-muted-foreground">Print it for your tables. A guest scans it and pays you on Mesita.</p>
        {!live ? <p className="text-muted-foreground text-xs">Guests can pay with it once Mesita Pay is on.</p> : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
      </div>
      <button type="button" className={cn(PILL_BUTTON_CLASS, "shrink-0")} onClick={download}>
        <DownloadSimpleIcon size={14} weight="bold" aria-hidden />
        Download
      </button>
    </li>
  );
}
