import { task, type TaskContext } from "@renderinc/sdk/workflows";

// The pipeline proof. Enrichment replaces this task once the host is deploying.
task(
  { name: "hello" },
  function hello(_ctx: TaskContext, name: string): string {
    return `hello ${name}`;
  },
);
