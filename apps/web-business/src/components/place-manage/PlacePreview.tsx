"use client";

// The place as guests see it (MESITA-3103), the same phone admin's Preview
// draws: packages/place-profile over the saved row. Since MESITA-3136 it
// opens in a modal from Profile's Preview button.

import { Component, type ReactNode } from "react";
import { PlaceProfile } from "@mesita/place-profile";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { memberPreviewDetail } from "./member-preview";

export function PlacePreview() {
  const { place, profile, isDirty } = usePlaceContext();
  const enriched =
    place.enriched === true ||
    (typeof place.enriched_at === "string" && place.enriched_at.trim() !== "");

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {enriched ? null : (
        <p className="text-muted-foreground shrink-0 text-sm">
          Mesita is still filling in this profile from public sources. Guests see it as it is now.
        </p>
      )}
      {isDirty ? (
        <p className="text-muted-foreground shrink-0 text-sm">Showing the saved profile. Your unsaved edits show here once you Save.</p>
      ) : null}
      <PreviewBoundary name={place.name}>
        <MemberPhone
          place={place}
          tags={profile.tags}
        />
      </PreviewBoundary>
    </div>
  );
}

function MemberPhone({
  place,
  tags,
}: {
  place: Parameters<typeof memberPreviewDetail>[0];
  tags: Parameters<typeof memberPreviewDetail>[1];
}) {
  const detail = memberPreviewDetail(place, tags);
  return (
    <div className="member-phone border-border mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden border md:rounded-3xl md:shadow-elev">
      <PlaceProfile
        place={detail}
        scrollLabel="Member profile preview"
      />
    </div>
  );
}

function PreviewFallback({
  name,
  onRetry,
}: {
  name: string;
  onRetry: () => void;
}) {
  return (
    <div className="border-border mx-auto flex w-full max-w-md flex-col gap-3 rounded-3xl border px-6 py-10 text-center">
      {name ? <p className="font-display text-lg font-semibold">{name}</p> : null}
      <p>This profile didn&apos;t load.</p>
      <button
        type="button"
        onClick={onRetry}
        className="border-border mx-auto rounded-full border px-4 py-2 text-sm font-semibold"
      >
        Try again
      </button>
    </div>
  );
}

class PreviewBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <PreviewFallback
          name={this.props.name}
          onRetry={() => this.setState({ failed: false })}
        />
      );
    }
    return this.props.children;
  }
}
