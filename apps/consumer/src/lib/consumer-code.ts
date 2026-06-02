const SEQUENTIAL_RE = /^[0-9]{4}-[0-9]{4}$/;

export function formatSequentialCode(n: number): string {
  const hi = Math.floor(n / 10000);
  const lo = n % 10000;
  return `${String(hi).padStart(4, "0")}-${String(lo).padStart(4, "0")}`;
}

export function displayConsumerCode(code: string): string {
  if (SEQUENTIAL_RE.test(code)) return code;
  const digits = code.replace(/[^0-9]/g, "");
  if (digits.length === 8) return formatSequentialCode(Number(digits));
  return code;
}
