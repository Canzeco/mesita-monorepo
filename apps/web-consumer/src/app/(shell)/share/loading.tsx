import { Skeleton } from "@/components/shared";
import {
  SEND_CHANNELS,
  SEND_DISC,
  SEND_DOOR,
  SEND_LABELS,
  SHARE_CARD_BOX,
  ShareFrame,
} from "@/components/consumer/share/share-frame";

// /share's fallback. The page reads nothing, but a tap on the bar still
// waits a server round trip for it, and until now that wait was the (shell)
// spinner centred on grey (Pato, MESITA-2701: "the placeholders must be
// similar to the page you are loading, like the sizes").
//
// SharePage's own frame (ShareFrame, share-frame.tsx): the scroller, the
// title, the line under it, Send it and the preview line are the page's
// words, drawn as themselves. Only two things wait: the 1200×630 card is a
// block in its box until the image paints, and each way to send is its
// 56px disc as a block over its word, since the channel's colours stay off
// a skeleton.
export default function ShareLoading() {
  return (
    <ShareFrame
      aria-busy
      card={<Skeleton className={SHARE_CARD_BOX} />}
      doors={SEND_CHANNELS.map((channel) => (
        <div key={channel} aria-hidden className={SEND_DOOR}>
          <Skeleton className={SEND_DISC} />
          {SEND_LABELS[channel]}
        </div>
      ))}
    >
      <p role="status" className="sr-only">
        Loading Share
      </p>
    </ShareFrame>
  );
}
