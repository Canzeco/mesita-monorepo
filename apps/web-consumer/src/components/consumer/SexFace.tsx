import { cn } from "@/lib/utils";

/** THE FACE OF SOMEONE WITH NO PHOTO SHOWN (Pato, 2026-11-24, MESITA-4854:
 *  "show sex color as background … male is blue, female is pink, other is
 *  black … and then the age"): the sex's colour with the age in it. The words
 *  beside it say the same ("Man, 23"), never colour alone. */
export function SexFace({ sex, age, className }: { sex: string | null | undefined; age: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex items-center justify-center rounded-full font-semibold text-white tabular-nums",
        sex === "female" ? "bg-pink-600" : sex === "male" ? "bg-blue-600" : "bg-black",
        className,
      )}
      data-sex-face={sex ?? "undisclosed"}
    >
      {age}
    </span>
  );
}
