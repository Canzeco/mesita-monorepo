import { FLEET } from "./catalog";

/** One scan line: four agents, direction, no diagram. */
export function FleetStrip() {
  return (
    <ul className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-1 type-meta">
      {FLEET.map((a) => (
        <li key={a.key}>
          <span className="text-foreground font-semibold">{a.key}</span>
          {` ${a.arrow} ${a.side}`}
        </li>
      ))}
    </ul>
  );
}
