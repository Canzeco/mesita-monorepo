// App-wide 404. Reached by anything that isn't a check URL: /check with no
// code, a truncated scan, a stale link someone bookmarked. Next's default
// 404 is an English, unstyled system page — staff would read it as "the app
// is broken", so this one is Mesita, in Spanish, with a way back.

import Link from "next/link";
import { MapPinOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-md rounded-2xl border p-8 text-center shadow-sm">
        <span className="bg-muted text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-full">
          <MapPinOff className="size-6" />
        </span>
        <h1 className="font-display mt-4 text-xl font-semibold tracking-tight">
          Esta página no existe
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Mesita Check solo abre tickets escaneados desde la app del cliente. Si
          escribiste el código a mano, vuelve al inicio y captúralo de nuevo.
        </p>
        <Button asChild className="mt-5 w-full" size="lg">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
