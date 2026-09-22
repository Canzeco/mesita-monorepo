// THE GROUP GRAMMAR (MESITA-2034). Apple's macOS System Settings shape: a
// heading and its description OUTSIDE a card, ONE card of rows inside it, an
// optional footer under it. This replaces `Section` on every Setup half —
// `Section` drew the heading INSIDE the card ("card-in-card" once a Setup
// half's own `RULES_CARD` sat inside it), which is the exact idiom Pato's
// screenshot showed and the whole Setup standard exists to kill.
//
//   Channels                                   ← h2, GROUP_HEADING_CLASS
//   Where an order can come from…               ← GROUP_DESC_CLASS
//   ┌─────────────────────────────────────────┐
//   │ Mesita app                    Connected │  ← ONE card, rows or a body
//   │ ─────────────────────────────────────── │
//   │ Rappi        [Reconnect] [Reconnect]    │
//   └─────────────────────────────────────────┘
//   Replies go out under the account above.     ← GROUP_FOOTER_CLASS, optional
//
// A ONE-ROW GROUP MUST JUSTIFY ITSELF. A Group holding exactly one row is a
// card built to hold a sentence — the paragraph-as-card idiom this standard
// deletes elsewhere, reappearing one level down. Locked (§7 of the Setup
// standard) is the one sanctioned exception; every other one-row case folds
// into a neighbour's footer or a state row's note instead. This is `NODE_ENV`
// development-only console guidance, not a hard runtime throw — a Group is
// still a presentational component, and a compile-time enum of "how many
// children" is not worth the type gymnastics for a codebase this size.
import { GROUP_DESC_CLASS, GROUP_FOOTER_CLASS, GROUP_HEADING_CLASS } from "@/lib/ui-classes";

export function Group({
  id,
  title,
  description,
  right,
  footer,
  children,
  /** Locked (§7) is the one sanctioned one-row Group. Every other call site
   *  should have 2+ rows, a Table, or a picker grid inside it — see the file
   *  header. Passing this silences the dev-only console warning below. */
  allowOneRow = false,
}: {
  id?: string;
  title: string;
  description?: string;
  /** A verb that acts on the WHOLE group ("Preview", "Change provider", "Add
   *  a dish") — trailing on the title line. A verb for one setting lives in
   *  that row instead. */
  right?: React.ReactNode;
  /** One line, under the card. Never a paragraph — the group's description
   *  already says what the card does; the footer says one more true thing. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  allowOneRow?: boolean;
}) {
  if (process.env.NODE_ENV !== "production" && !allowOneRow) {
    const count = Array.isArray(children)
      ? children.filter(Boolean).length
      : children != null
        ? 1
        : 0;
    if (count === 1) {
      console.warn(
        `Group "${title}": one row is a card built to hold a sentence. ` +
          `Fold it into a neighbour's footer or a state row's note, or pass ` +
          `allowOneRow (Locked is the only sanctioned exception).`,
      );
    }
  }

  const titleId = id ?? `group-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className={GROUP_HEADING_CLASS}>
            {title}
          </h2>
          {description && <p className={GROUP_DESC_CLASS}>{description}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-lg border">
        {children}
      </div>
      {footer && <p className={GROUP_FOOTER_CLASS}>{footer}</p>}
    </section>
  );
}
