import type { Metadata } from "next";
import { ImagePlus, Star } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Note } from "@/components/ui";
import { photos } from "@/lib/mock";
import { profileTabs } from "../tabs";

export const metadata: Metadata = { title: "Profile photos" };

export default function ProfilePhotos() {
  return (
    <PageBody>
      <PageHeader title="Profile" sub={`${photos.length} photos · guests decide with these`} tabs={profileTabs} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <div key={p.id} className={`relative flex aspect-[4/3] items-end rounded-xl bg-linear-to-br p-3 text-white ${p.tone}`}>
            <span className="text-sm font-medium drop-shadow">{p.label}</span>
            {i === 0 ? (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs">
                <Star className="size-3" aria-hidden /> Cover
              </span>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:bg-muted"
        >
          <ImagePlus className="size-6" aria-hidden />
          Add photos
        </button>
      </div>
      <Note>Add at least 8. The first one is your cover on Mesita and your website.</Note>
    </PageBody>
  );
}
