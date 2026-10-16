import path from "node:path";
import { defineConfig } from "vitest/config";

const consumerModules = path.resolve(
  import.meta.dirname,
  "../../apps/web-consumer/node_modules",
);

export default defineConfig({
  resolve: {
    alias: {
      react: path.join(consumerModules, "react"),
      "react-dom": path.join(consumerModules, "react-dom"),
      next: path.join(consumerModules, "next"),
      "lucide-react": path.join(consumerModules, "lucide-react"),
      clsx: path.join(consumerModules, "clsx"),
      "tailwind-merge": path.join(consumerModules, "tailwind-merge"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
