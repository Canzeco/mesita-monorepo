// Uniform miss for /check/<code> — unknown, malformed, or purged codes all
// land here identically (the EF is not an existence oracle, and neither is
// this page).

import { ShieldX } from "lucide-react";

export default function CheckNotFound() {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-md rounded-2xl border p-8 text-center shadow-sm">
        <span className="bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full">
          <ShieldX className="size-6" />
        </span>
        <h1 className="font-display mt-4 text-xl font-semibold tracking-tight">
          Este check no es válido
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          El código no corresponde a ningún ticket de Mesita. Pide al cliente
          que muestre el QR desde su app.
        </p>
      </div>
    </main>
  );
}
