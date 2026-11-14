import { Link2, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

// The marks on Share's rows (MESITA-3867). Each sits in the grey 36px chip
// every Me row wears; only the mark carries the channel's colour, so the
// rows stay quiet (Pato, MESITA-3340: "keep discrete gray buttons, but logos
// with colors" — a loud button is an invitation to leave the app). Copy link
// and More are Mesita's own actions, in ink.

/** WhatsApp's mark (the same path as public/channels/whatsapp.svg). */
function WhatsAppMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="#25D366"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

/** Instagram's outline mark, stroked with its gradient: a line icon on the
 *  grey chip, never a gradient-filled chip. The gradient id is fixed; the
 *  page and its loading frame draw the same one, so a duplicate still
 *  paints the same colours. */
function InstagramMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <defs>
        <linearGradient id="share-instagram-mark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FEDA75" />
          <stop offset="0.35" stopColor="#FA7E1E" />
          <stop offset="0.6" stopColor="#D62976" />
          <stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <g stroke="url(#share-instagram-mark)">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.25" />
        <path d="M17.5 6.5h.01" />
      </g>
    </svg>
  );
}

/** A filled speech bubble in Messages green. */
function MessagesMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="#34C759"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M12 3C6.48 3 2 6.69 2 11.2c0 2.47 1.34 4.68 3.46 6.18L4.6 21l4.03-2.2c1.07.29 2.2.44 3.37.44 5.52 0 10-3.69 10-8.04S17.52 3 12 3Z" />
    </svg>
  );
}

export type ShareChannel = "whatsapp" | "instagram" | "messages" | "copy" | "more";

/** Each row's mark. */
export const CHANNEL_MARKS: Record<ShareChannel, ReactNode> = {
  whatsapp: <WhatsAppMark />,
  instagram: <InstagramMark />,
  messages: <MessagesMark />,
  copy: <Link2 className="text-foreground h-5 w-5" strokeWidth={2} aria-hidden />,
  more: (
    <MoreHorizontal
      className="text-foreground h-5 w-5"
      strokeWidth={2}
      aria-hidden
    />
  ),
};
