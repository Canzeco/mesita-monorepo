"use client";

import "./globals.css";
import { RouteError } from "@/components/consumer/RouteError";

// The root layout itself threw: this replaces the whole document, so it
// draws its own <html> and <body> (MESITA-2993).
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <body className="bg-background text-foreground flex min-h-dvh flex-col antialiased">
        <title>Mesita</title>
        <RouteError error={error} retry={retry} />
      </body>
    </html>
  );
}
