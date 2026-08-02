"use client";

// Mesita Check home. Staff normally never see this page — scanning a
// guest's QR lands them straight on /check/<code>. This is the fallback
// door: a hand-typed check code (camera trouble, broken screen) and a
// one-glance explanation of what the app is.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, QrCode, ReceiptText, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function CheckoutHome() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const trimmed = code.trim();

  const go = () => {
    if (trimmed) router.push(`/check/${encodeURIComponent(trimmed)}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-2xl">
          <ScanLine className="size-5" />
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Mesita Check
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Escanea el QR que el cliente genera en su app de Mesita. Si el QR es
          real, aquí se abre su ticket — con la cuenta, el descuento y los
          pasos de la visita.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="border-border bg-card flex items-start gap-3 rounded-2xl border p-3.5">
          <span className="bg-secondary/10 text-secondary grid size-9 shrink-0 place-items-center rounded-xl">
            <QrCode className="size-[18px]" />
          </span>
          <p className="text-muted-foreground text-[13px] leading-snug">
            <span className="text-foreground font-semibold">
              Escanea con la cámara del teléfono.
            </span>{" "}
            No necesitas iniciar sesión: el código del ticket es la
            verificación.
          </p>
        </div>
        <div className="border-border bg-card flex items-start gap-3 rounded-2xl border p-3.5">
          <span className="bg-secondary/10 text-secondary grid size-9 shrink-0 place-items-center rounded-xl">
            <ReceiptText className="size-[18px]" />
          </span>
          <p className="text-muted-foreground text-[13px] leading-snug">
            <span className="text-foreground font-semibold">
              Captura la cuenta y confirma el pago.
            </span>{" "}
            El descuento se aplica directo en la mesa — Mesita nunca guarda el
            dinero.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label
          htmlFor="check-code"
          className="text-muted-foreground text-[11px] font-bold tracking-[0.14em] uppercase"
        >
          ¿No escanea? Escribe el código del ticket
        </label>
        <div className="flex items-stretch gap-2">
          <input
            id="check-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") go();
            }}
            placeholder="Código del QR"
            autoComplete="off"
            spellCheck={false}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground h-12 w-full rounded-xl border px-4 font-mono text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button
            type="button"
            onClick={go}
            disabled={!trimmed}
            className="h-12 shrink-0 rounded-xl px-4"
            aria-label="Abrir ticket"
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </main>
  );
}
