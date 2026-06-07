"use client";

import { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { displayConsumerCode } from "@/lib/consumer-code";

export function MyQrCard({ code }: { code: string }) {
  const displayCode = displayConsumerCode(code);
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <section className="surface-card-soft p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="text-secondary h-3.5 w-3.5" />
        <p className="text-secondary text-[10px] font-bold tracking-wider uppercase">
          Your code
        </p>
      </div>
      <div className="mt-3 flex flex-col items-center gap-3">
        <div className="border-border bg-background w-full max-w-[300px] rounded-2xl border p-5">
          <QRCodeSVG
            value={`mesita:${displayCode}`}
            size={260}
            className="h-auto w-full"
            bgColor="transparent"
            fgColor="currentColor"
            level="M"
            marginSize={0}
          />
        </div>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Code copied" : "Copy code"}
          className="border-border bg-background text-foreground hover:bg-muted flex items-center gap-2 rounded-lg border px-4 py-2 text-base font-medium tracking-[0.16em] tabular-nums transition"
        >
          {displayCode}
          {copied ? (
            <Check className="text-secondary h-3.5 w-3.5" />
          ) : (
            <Copy className="text-muted-foreground h-3.5 w-3.5" />
          )}
        </button>
        <p className="text-muted-foreground text-center text-[11px]">
          Your 8-digit Mesita code — show it when you ask for the check.
          <br />
          Staff scan the QR or type it in WhatsApp / their console.
        </p>
      </div>
    </section>
  );
}
