import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";

// The shell both legal routes render — /terms and /privacy, the two pages
// Me › Support › Legal links to. They live in this app, outside the (shell)
// auth wall, so anyone can read them before signing in.
//
// They are NOT reviewed legal text and must not be read as any commitment:
// `DRAFT_DATE` plus <DraftNotice /> say so at the top of both pages, in a band
// nobody can scroll past without reading.
//
// The copy rule for whoever edits these next: describe only what the code
// already does, and name no regulator, no framework and no retention period
// that cannot be pointed at in this repo. A drafted promise is still a
// promise.

/** The day this draft was written. Shown verbatim in the banner on both pages. */
export const DRAFT_DATE = "October 10, 2026";

/** Where a reader takes a question about either page. */
export const LEGAL_SUPPORT_EMAIL = "support@mesita.ai";
export const LEGAL_PRIVACY_EMAIL = "privacy@mesita.ai";

function DraftNotice() {
  return (
    <div className="border-destructive/35 bg-destructive/10 border-b">
      <div className="mx-auto flex w-full max-w-3xl items-start gap-3 px-5 py-5">
        <span className="text-destructive mt-0.5 shrink-0">
          <TriangleAlert className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-destructive type-eyebrow">
            Unreviewed draft · {DRAFT_DATE}
          </p>
          <p className="text-foreground mt-2 text-sm leading-relaxed">
            This page has not been reviewed by a lawyer. It is a plain-language
            draft of how Mesita works today. It is not a contract, it makes no
            commitment, and it will be replaced once legal review is done.
          </p>
        </div>
      </div>
    </div>
  );
}

function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {heading}
      </h2>
      <div className="text-muted-foreground mt-3 flex flex-col gap-3 text-base leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function LegalPage({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <main className="bg-background text-foreground h-full overflow-y-auto">
      <DraftNotice />
      <article className="mx-auto w-full max-w-3xl px-5 py-12">
        <p className="text-muted-foreground type-eyebrow">
          {eyebrow}
        </p>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
          {lede}
        </p>
        <div className="mt-12">{children}</div>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mt-14 inline-flex items-center gap-2 text-sm transition"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Mesita
        </Link>
      </article>
    </main>
  );
}

export { DraftNotice, LegalPage, LegalSection };
