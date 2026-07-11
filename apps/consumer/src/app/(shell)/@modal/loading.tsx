import { Spinner } from "@/components/shared/Spinner";

// Slot-level fallback. Every modal segment ships its own layout + skeleton
// loading, so this only covers the beat before a segment resolves. Subtle
// translucent scrim inside the card — never `fixed` (that escapes the
// MobileFrame on desktop), never an opaque white flash.
export default function ModalLoading() {
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/20">
      <Spinner label="Loading" className="border-white/40 border-t-white" />
    </div>
  );
}
