import { INPUT_CLASS } from "@/lib/ui-classes";
import { normalizeInstagramHandle } from "@/lib/instagram-handle";

/** The Instagram username field (MESITA-4858), onboarding's and Me's: a
 *  username, an @username or a profile link, with the handle it reads as
 *  shown under it so a typo is seen. */
export function InstagramHandleField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const handle = normalizeInstagramHandle(value);
  const invalid = value.trim() !== "" && !handle;
  return (
    <div>
      <label htmlFor={id} className="type-label mb-1 block font-semibold">
        Instagram username
      </label>
      <input
        id={id}
        name="instagram"
        className={INPUT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={200}
        placeholder="@username or profile link"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-reads`}
      />
      <p
        id={`${id}-reads`}
        aria-live="polite"
        className={invalid ? "text-destructive type-label mt-2" : "type-label mt-2 min-h-5 font-semibold"}
      >
        {invalid ? "That isn't an Instagram username." : handle ? `@${handle}` : ""}
      </p>
    </div>
  );
}
