const cwd = Deno.cwd();
const msg = Deno.args[0] ?? "fix";
await new Deno.Command("git", { args: ["add", "-A"], cwd }).output();
const out = await new Deno.Command("git", { args: ["commit", "-m", msg], cwd }).output();
console.error(new TextDecoder().decode(out.stderr));
if (!out.success) Deno.exit(out.code);
const push = await new Deno.Command("git", { args: ["push"], cwd }).output();
console.error(new TextDecoder().decode(push.stderr));
Deno.exit(push.code);
