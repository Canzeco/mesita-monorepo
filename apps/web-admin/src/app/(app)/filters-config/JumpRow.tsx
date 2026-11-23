"use client";

// Discovery's jump row (MESITA-4694): the Multiple Places bar (the same shell
// and numbered chips, from the kit's class strings) over the page's seven
// sections. One line that scrolls sideways at every width: seven chips do not
// fit one line on a narrow pane, and a wrapped bar would be taller than the
// cards' scroll margin. z-30: the Ranking table's pinned header cell is z-20.
//
// A jump REPLACES the hash, so Back leaves the page in one press. The links
// are real anchors; only a plain left click is taken over.

import { useEffect } from "react";
import { JUMP_BAR_CLASS, JUMP_CHIP_CLASS, JUMP_CHIP_NUMBER_CLASS } from "@/components/admin-ui/classes";

const HOW = "s-how";

const SECTIONS: readonly (readonly [string, string])[] = [
  ["s-ranking", "Ranking"],
  ["s-mixing", "Mixing"],
  ["s-social", "Social"],
  ["s-scores", "Scores"],
  ["s-map", "Map"],
  // `s-name` is frozen: Crenup, Multiple Places and Single Place link to it.
  ["s-name", "Search bars"],
  [HOW, "How ranking works"],
];

/** Opens the closed text of the How ranking works card. The kit's disclosure
 *  opens on its own hash only on load and on a hash change, and it carries no
 *  id here, so the row opens it. */
function openHow() {
  const text = document.querySelector<HTMLDetailsElement>(`#${HOW} > details`);
  if (text) text.open = true;
}

export function JumpRow() {
  useEffect(() => {
    // The literal hash: never decoded, never used as a selector.
    if (location.hash === `#${HOW}`) openHow();
  }, []);
  return (
    <nav aria-label="Discovery sections" className={`${JUMP_BAR_CLASS} z-30`}>
      <ol className="scrollbar-none flex gap-2 overflow-x-auto">
        {SECTIONS.map(([id, label], i) => (
          <li key={id} className="shrink-0">
            <a
              href={`#${id}`}
              className={JUMP_CHIP_CLASS}
              onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                if (id === HOW) openHow();
                location.replace(`#${id}`);
              }}
            >
              <span aria-hidden className={JUMP_CHIP_NUMBER_CLASS}>
                {i + 1}
              </span>
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
