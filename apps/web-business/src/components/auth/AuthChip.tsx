// Tiny pill between the auth heading and the form. Two tones: "muted"
// for the signed-in-as breadcrumb, "error" for the OAuth-failed notice.
export function AuthChip({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "bg-destructive/10 text-destructive"
      : "text-muted-foreground bg-muted/60";
  return (
    <p
      className={
        "mt-3 inline-block rounded-full px-3 py-1 text-[11.5px] " + cls
      }
    >
      {children}
    </p>
  );
}
