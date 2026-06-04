"use client";

import Image from "next/image";
import { Instagram, ImageIcon } from "lucide-react";
import { formatInstagramHandle } from "@/lib/api/pay";
import { cn } from "@/lib/utils";

/** Instagram story aspect preview — where photo/video and tags go. */
export function TicketStoryFrame({
  venuePhotoUrl,
  venueName,
  venueInstagramHandle,
  className,
}: {
  venuePhotoUrl?: string | null;
  venueName?: string | null;
  venueInstagramHandle?: string | null;
  className?: string;
}) {
  const venueTag = formatInstagramHandle(venueInstagramHandle);
  const mesitaTag = "@mesita";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <p className="text-muted-foreground mb-1.5 text-center text-[10px] font-medium">
        Your story goes in this frame
      </p>
      <div
        className="border-primary/35 bg-muted/40 relative w-[148px] shrink-0 overflow-hidden rounded-2xl border border-dashed shadow-sm"
        style={{ aspectRatio: "9 / 16" }}
        aria-label="Instagram story preview"
      >
        {venuePhotoUrl ? (
          <Image
            src={venuePhotoUrl}
            alt=""
            fill
            className="object-cover opacity-35 blur-[1px]"
            sizes="148px"
          />
        ) : (
          <div className="from-muted to-muted/60 absolute inset-0 bg-gradient-to-b" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-1 pt-2">
          <Instagram className="h-3 w-3 text-white drop-shadow" strokeWidth={2} />
          <span className="text-[8px] font-semibold tracking-wide text-white/95 uppercase drop-shadow">
            Story
          </span>
        </div>

        <div className="absolute inset-2.5 flex flex-col items-center justify-center rounded-lg border border-white/25 border-dashed bg-black/20 px-1">
          <ImageIcon className="mb-1 h-5 w-5 text-white/70" strokeWidth={1.5} />
          <p className="max-w-[110px] text-center text-[9px] leading-snug font-medium text-white/90">
            Photo or video
            {venueName ? (
              <>
                <br />
                <span className="text-white/70 line-clamp-2">{venueName}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="absolute bottom-7 left-2 right-2 flex flex-col items-start gap-1">
          <StoryMentionTag handle={mesitaTag} emphasized />
          {venueTag ? <StoryMentionTag handle={venueTag} /> : null}
        </div>

        <div className="absolute bottom-1 left-0 right-0 text-center">
          <p className="text-[7px] font-medium text-white/75 drop-shadow">
            Tag both accounts
          </p>
        </div>
      </div>
    </div>
  );
}

function StoryMentionTag({
  handle,
  emphasized = false,
}: {
  handle: string;
  emphasized?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold shadow-sm",
        emphasized
          ? "bg-primary text-primary-foreground"
          : "bg-white/95 text-foreground",
      )}
    >
      {handle}
    </span>
  );
}
