"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { PlaceProfile } from "@mesita/place-profile";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { placeTabHref } from "@/lib/place-tabs";
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
          This place is not enriched yet.{" "}
          <Link
            href={placeTabHref(place.id, "admin")}
            className="text-foreground font-medium underline"
          >
            Open Admin
          </Link>
        </p>
      )}
      {isDirty ? (
        <p className="text-muted-foreground shrink-0 text-sm">
          Showing the saved profile. Unsaved edits stay on{" "}
          <Link
            href={placeTabHref(place.id, "profile")}
            className="text-foreground font-medium underline"
          >
            Profile
          </Link>{" "}
          until you Save.
        </p>
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
