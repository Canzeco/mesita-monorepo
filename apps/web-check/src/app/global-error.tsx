"use client";

// Last resort: the root layout itself threw, so this replaces <html>. Next
// mounts it without the layout's fonts, so the styling stays deliberately
// self-contained — no design tokens, no icon imports, nothing that could
// throw a second time.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          background: "#fdf7f7",
          color: "#2a1114",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            Mesita Check no pudo cargar
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#6b4a4f",
            }}
          >
            Vuelve a intentarlo. Si sigue fallando, pide al cliente que abra su
            QR otra vez desde la app de Mesita.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              width: "100%",
              height: "2.75rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#e11d48",
              color: "#fff",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: "0.75rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.6875rem",
                color: "#96777b",
              }}
            >
              {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
