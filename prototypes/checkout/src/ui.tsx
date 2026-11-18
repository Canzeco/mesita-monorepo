import type { ReactNode } from "react";
import { mx } from "./money";

export function Row({ icon, label, value, strong, sub }: { icon?: ReactNode; label: ReactNode; value: ReactNode; strong?: boolean; sub?: ReactNode }) {
  return (
    <div className={`row${strong ? " row-strong" : ""}`}>
      <span className="row-label">
        {icon}
        <span>
          {label}
          {sub ? <span className="row-sub">{sub}</span> : null}
        </span>
      </span>
      <span className="row-value">{typeof value === "number" ? mx(value) : value}</span>
    </div>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={`toggle${disabled ? " is-disabled" : ""}`}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        className={`switch${on ? " is-on" : ""}`}
        onClick={() => onChange(!on)}
      >
        <span className="knob" />
      </button>
    </label>
  );
}

export function Err({ text }: { text: string | null }) {
  return text ? <p className="error" role="alert">{text}</p> : null;
}

export function Phone({ title, children, tone }: { title: string; children: ReactNode; tone?: "green" | "amber" }) {
  return (
    <section className="panel phone">
      <h2 className="panel-title">{title}</h2>
      <div className={`screen${tone ? ` tone-${tone}` : ""}`}>{children}</div>
    </section>
  );
}
