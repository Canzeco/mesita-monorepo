import { AlertTriangle } from "lucide-react";

// Destructive notice — a hairline-bordered box with a warning glyph, used
// across the admin console for form/section errors. Single source so the
// three former copies (manage-single, enricher-config, admin-config) can't
// drift apart.
//
// `inline` sits under a field or section and carries its own mt-4, since
// almost every caller drops it into unspaced flow. `page` is the whole body
// of a route that failed to load — it stands alone, so no margin.
export function ErrorNote({
  message,
  size = "inline",
}: {
  message: string;
  size?: "inline" | "page";
}) {
  const page = size === "page";
  return (
    <div
      className={
        "border-destructive/40 bg-destructive/5 text-destructive flex items-start border " +
        (page ? "gap-3 rounded-2xl p-4 text-sm" : "mt-4 gap-2 rounded-xl p-3 text-xs")
      }
    >
      <AlertTriangle className={"mt-0.5 shrink-0 " + (page ? "h-4 w-4" : "h-3.5 w-3.5")} />
      <p className="font-medium">{message}</p>
    </div>
  );
}
