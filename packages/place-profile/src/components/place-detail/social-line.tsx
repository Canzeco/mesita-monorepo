"use client";

// The line under the title (MESITA-2442): stacked faces, then "Perdón and 3
// others saw this". People first; no counts by verb, no social block inside
// Reviews. The caller passes what the server said; nobody visible → nothing.

import { DefaultAvatar } from "../DefaultAvatar";

/** No account id: faces are keyed by position (MESITA-2460). */
export type SocialFace = {
  name: string;
  avatarUrl: string | null;
};

export function SocialLine({
  faces,
  text,
}: {
  faces: readonly SocialFace[];
  text: string | null;
}) {
  if (!text) return null;
  const shown = faces.slice(0, 3);
  return (
    <p className="text-foreground flex items-center gap-2 pt-1 text-sm" data-testid="social-line">
      {shown.length > 0 ? (
        <span className="flex shrink-0 -space-x-2" aria-hidden>
          {shown.map((f, i) =>
            f.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={f.avatarUrl}
                alt=""
                className="border-card h-6 w-6 rounded-full border-2 object-cover"
              />
            ) : (
              // The one no-photo face (MESITA-2620), never an initial.
              <span
                key={i}
                className="border-card block h-6 w-6 overflow-hidden rounded-full border-2"
              >
                <DefaultAvatar className="h-full w-full" />
              </span>
            ),
          )}
        </span>
      ) : null}
      <span className="min-w-0 font-medium">{text}</span>
    </p>
  );
}
