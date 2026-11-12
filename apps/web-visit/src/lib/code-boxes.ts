// The waiter code as six boxes (MESITA-3818). Auth-adjacent: the code stays
// one string (an empty box is a space), so sign-gate reads it unchanged and a
// gap never passes as six digits. Pure; GuestVerify moves the focus.

export const CODE_LENGTH = 6;

/** The six boxes' digits, "" for an empty box. */
export function codeDigits(code: string): string[] {
  return Array.from({ length: CODE_LENGTH }, (_, i) => (/\d/.test(code[i] ?? "") ? code[i] : ""));
}

function join(digits: string[]): string {
  return digits.map((d) => d || " ").join("").trimEnd();
}

/** Typing, pasting or autofill into box `index`: the digits fill from that
 *  box onward, non-digits ignored. One digit moves to the next box; several
 *  focus the last one filled. */
export function fillCode(code: string, index: number, typed: string): { code: string; focus: number } {
  const incoming = typed.replace(/\D/g, "").slice(0, CODE_LENGTH - index);
  if (!incoming) return { code, focus: index };
  const digits = codeDigits(code);
  for (let i = 0; i < incoming.length; i++) digits[index + i] = incoming[i];
  const last = index + incoming.length - 1;
  const focus = incoming.length === 1 ? Math.min(index + 1, CODE_LENGTH - 1) : last;
  return { code: join(digits), focus };
}

/** Backspace in box `index`: clears it; on an empty box, clears the one
 *  before and moves there. */
export function backspaceCode(code: string, index: number): { code: string; focus: number } {
  const digits = codeDigits(code);
  if (digits[index]) {
    digits[index] = "";
    return { code: join(digits), focus: index };
  }
  if (index === 0) return { code, focus: 0 };
  digits[index - 1] = "";
  return { code: join(digits), focus: index - 1 };
}
