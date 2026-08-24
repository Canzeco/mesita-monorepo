"use client";

// Route-level error boundary. Anything that throws while rendering a check
// (a payload shape we didn't expect, a client crash mid-visit) lands here
// instead of on a blank white screen with a table waiting.

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function CheckError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No error tracker in this app yet — the browser console and the Vercel
    // function logs are what a debug session has.
    console.error("[check] render error", error);
  }, [error]);

  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-md rounded-2xl border p-8 text-center shadow-sm">
        <span className="bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full">
          <TriangleAlert className="size-6" />
        </span>
        <h1 className="font-display mt-4 text-xl font-semibold tracking-tight">
          Algo salió mal
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          No pudimos mostrar esta pantalla. Vuelve a intentarlo — si sigue
          fallando, pide al cliente que abra su QR otra vez.
        </p>
        <Button className="mt-5 w-full" size="lg" onClick={reset}>
          <RotateCw /> Reintentar
        </Button>
        {error.digest ? (
          <p className="text-muted-foreground mt-3 font-mono text-[11px]">
            {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}
