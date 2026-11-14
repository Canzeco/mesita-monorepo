import {
  SHARE_ROWS,
  ShareFrame,
  ShareRowBody,
  shareRowClass,
} from "@/components/consumer/share/share-frame";

// /share's fallback (MESITA-2701: "the placeholders must be similar to the
// page you are loading"). The page reads nothing, so the fallback is the page
// itself with inert rows: the same frame, words and marks, and nothing moves
// when it lands.
export default function ShareLoading() {
  return (
    <ShareFrame
      rows={SHARE_ROWS.map((spec) => (
        <div key={spec.channel} aria-hidden className={shareRowClass(spec)}>
          <ShareRowBody spec={spec} />
        </div>
      ))}
    >
      <p role="status" className="sr-only">
        Loading Share
      </p>
    </ShareFrame>
  );
}
