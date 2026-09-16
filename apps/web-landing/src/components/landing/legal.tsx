import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Footer } from "@/components/landing/footer";
import { Nav } from "@/components/landing/nav";

// The shell both legal routes render (MESITA-1888).
//
// Why it exists: web-consumer and mobile-consumer have shipped "Terms of use"
// and "Privacy policy" rows for months, pointing at mesita.ai/terms and
// mesita.ai/privacy — two routes that did not exist, so both rows 404'd. The
// pages below stop that. They are NOT reviewed legal text and must not be read
// as any commitment: `DRAFT_DATE` plus <DraftNotice /> say so at the top of
// both pages, in a band nobody can scroll past without reading.
//
// The copy rule for whoever edits these next: describe only what the code
// already does, and name no regulator, no framework and no retention period
// that cannot be pointed at in this repo. A drafted promise is still a
// promise.

/** The day this draft was written. Shown verbatim in the banner on both pages. */
export const DRAFT_DATE = "September 15, 2026";

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
          <p className="text-destructive text-xs font-bold tracking-[0.14em] uppercase">
            Unreviewed draft · {DRAFT_DATE}
          </p>
          <p className="text-foreground mt-2 text-sm leading-relaxed">
            This page has not been reviewed by a lawyer. It is a plain-language
            draft of how Mesita works today, published so the app stops linking
            to a page that does not exist. It is not a contract, it makes no
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
      <h2 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
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
    <main className="bg-background min-h-screen">
      <Nav />
      <DraftNotice />
      <article className="mx-auto w-full max-w-3xl px-5 py-14 md:py-20">
        <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
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
          Back to mesita.ai
        </Link>
      </article>
      <Footer />
    </main>
  );
}

export { DraftNotice, LegalPage, LegalSection };
