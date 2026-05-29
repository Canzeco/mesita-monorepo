"use client";

import { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export function MyQrCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <section className="border-border bg-card rounded-3xl border p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="text-secondary h-3.5 w-3.5" />
        <p className="text-secondary text-[10px] font-bold tracking-wider uppercase">
          Your code
        </p>
      </div>
      <div className="mt-3 flex flex-col items-center gap-3">
        <div className="border-border bg-background rounded-2xl border p-3.5">
          <QRCodeSVG
            value={`mesita:${code}`}
            size={140}
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
          className="border-border bg-background text-foreground hover:bg-muted flex items-center gap-2 rounded-full border px-4 py-2 text-base font-medium tracking-[0.16em] tabular-nums transition"
        >
          {code}
          {copied ? (
            <Check className="text-secondary h-3.5 w-3.5" />
          ) : (
            <Copy className="text-muted-foreground h-3.5 w-3.5" />
          )}
        </button>
        <p className="text-muted-foreground text-center text-[11px]">
          Show this to the waiter when you ask for the check.
          <br />
          They&apos;ll scan it or type the code into their console.
        </p>
      </div>
    </section>
  );
}
