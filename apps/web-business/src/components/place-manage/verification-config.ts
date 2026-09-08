export const METHOD_LABEL = {
  ai_call: "AI phone call",
  ai_email: "AI email",
  video: "Walkthrough video",
  postcard: "Postcard",
  manual_contact: "Manual contact",
  // MESITA-1664 — the business console verifies against a mock code while
  // the real OTP is out of scope. Labelled plainly so an operator reading
  // the queue can tell a mocked verification from a proven one.
  mock_code: "Mock code",
} as const;

export function methodLabel(method: string | null | undefined): string {
  if (!method) return "";
  const known = METHOD_LABEL[method as keyof typeof METHOD_LABEL];
  if (known) return known;
  const clean = method.replace(/_/g, " ").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "";
}
