// Loading placeholder for every staff page (MESITA-4378): bones shaped like
// the proof card — a big amount, two lines, a button — never "Checking…".
export function Bones({ label }: { label: string }) {
  return (
    <div className="bones" role="status" aria-busy="true" aria-label={label}>
      <div className="bone" style={{ height: 56, width: "60%", alignSelf: "center" }} />
      <div className="bone" style={{ height: 18, width: "80%", alignSelf: "center" }} />
      <div className="bone" style={{ height: 18, width: "50%", alignSelf: "center" }} />
      <div className="bone" style={{ height: 160 }} />
      <div className="bone" style={{ height: 48 }} />
    </div>
  );
}
