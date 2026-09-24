const cwd = Deno.cwd();
const add = new Deno.Command("git", { args: ["add", "-A"], cwd });
if (!(await add.output()).success) Deno.exit(1);
const commit = new Deno.Command("git", {
  args: [
    "commit",
    "-m",
    "Land three-rung place plans and plan-gated product catalogue (MESITA-2020).\n\nFree/Pro/Ultra prices and labels sync through migration and admin reset; Ultra-only partner badge derivation, web-business minPlan gating, and Stripe catalog entries for monthly Pro and Ultra.",
  ],
  cwd,
});
const out = await commit.output();
console.log(new TextDecoder().decode(out.stdout));
console.error(new TextDecoder().decode(out.stderr));
Deno.exit(out.code);
