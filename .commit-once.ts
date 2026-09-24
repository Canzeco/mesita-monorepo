const cwd = Deno.cwd();
const add = new Deno.Command("git", { args: ["add", "-A"], cwd });
if (!(await add.output()).success) Deno.exit(1);
const commit = new Deno.Command("git", {
  args: ["commit", "-m", "Remove accidental commit helper script."],
  cwd,
});
const out = await commit.output();
console.error(new TextDecoder().decode(out.stderr));
Deno.exit(out.code);
