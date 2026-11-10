// Constant-time string comparison so an attacker probing a secret (bearer
// token, HMAC signature, …) can't extract bytes via timing analysis. The
// length-prefix check leaks only the length (already non-secret here), then
// the loop XOR-accumulates every byte so total work is independent of where
// the first mismatch is. Every secret or signature compare in functions/ goes
// through here: bearer keys, the agent tool secret, webhook HMACs.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i += 1) {
    acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return acc === 0;
}
