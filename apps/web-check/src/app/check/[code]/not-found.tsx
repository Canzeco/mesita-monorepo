// Uniform miss for /check/<code> — unknown, malformed, or purged codes all
// land here identically (the EF is not an existence oracle, and neither is
// this page).

import { ShieldX } from "lucide-react";

export default function CheckNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="size-6" />
        </span>
        <h1 className="font-display mt-4 text-xl font-semibold tracking-tight">
          Este check no es válido
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El código no corresponde a ningún ticket de Mesita. Pide al cliente
          que muestre el QR desde su app.
        </p>
      </div>
    </main>
  );
}
