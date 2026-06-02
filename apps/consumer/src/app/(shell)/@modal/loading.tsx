// Keep the current surface visible while intercepted modal routes load and
// add a subtle top-layer veil so we never flash shell chrome transitions.
export default function ModalLoading() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[55]">
      <div className="absolute inset-0 bg-black/28 backdrop-blur-[1px]" />
    </div>
  );
}
