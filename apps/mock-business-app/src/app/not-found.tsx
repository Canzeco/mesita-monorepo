import Link from "next/link";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-3xl font-semibold tracking-tight">Not a page here</p>
      <p className="text-muted-foreground max-w-prose text-sm">
        The mock console answers only the addresses its route contract names. A
        name outside it 404s on purpose, so that a typo never renders a generic
        page that looks like it worked.
      </p>
      <Link href="/" className={CTA_BUTTON_CLASS}>
        Back to the console
      </Link>
    </div>
  );
}
