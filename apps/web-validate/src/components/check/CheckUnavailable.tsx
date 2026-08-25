"use client";

// The check exists as far as we know — we just couldn't reach it. Rate
// limits, Edge Function cold starts, a dead phone signal: all of these used
// to render the "este check no es válido" card, which tells a waiter to
// send a paying guest away over a transient blip. This is the honest
// version, and it retries.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RotateCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

function copyFor(status: number): { title: string; body: string } {
  if (status === 0) {
    return {
      title: "Sin conexión",
      body: "No pudimos contactar a Mesita. Revisa la señal o el WiFi del teléfono y vuelve a intentarlo — el ticket sigue vivo.",
    };
  }
  if (status === 429) {
    return {
      title: "Demasiados escaneos seguidos",
      body: "Este teléfono hizo muchas consultas en poco tiempo. Espera unos segundos y vuelve a intentarlo.",
    };
  }
  return {
    title: "Mesita no responde",
    body: "El ticket existe, pero no pudimos cargarlo en este momento. Vuelve a intentarlo en unos segundos.",
  };
}

export function CheckUnavailable({ status }: { status: number }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const { title, body } = copyFor(status);
  const offline = status === 0;

  return (
    <div className="border-border bg-card rounded-2xl border p-8 text-center shadow-sm">
      <span className="bg-muted text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-full">
        {offline ? (
          <WifiOff className="size-6" />
        ) : (
          <CloudOff className="size-6" />
        )}
      </span>
      <h1 className="font-display mt-4 text-xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {body}
      </p>
      <Button
        className="mt-5 w-full"
        size="lg"
        disabled={retrying}
        onClick={() => startRetry(() => router.refresh())}
      >
        <RotateCw className={retrying ? "animate-spin" : undefined} />
        {retrying ? "Reintentando…" : "Reintentar"}
      </Button>
      <p className="text-muted-foreground mt-3 text-[11px] leading-snug">
        No cobres sin ver el ticket. Si sigue sin cargar, pide al cliente que
        vuelva a abrir su QR desde la app de Mesita.
      </p>
    </div>
  );
}
