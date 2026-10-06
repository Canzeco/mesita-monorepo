// Extends vitest's `expect` with jest-dom's DOM matchers (toBeEmptyDOMElement,
// etc.) for every test file, and provides their TypeScript types via
// declaration merging. Only the component tests (Group.test.tsx,
// Notice.test.tsx — each opted into jsdom via a `@vitest-environment` docblock)
// actually touch the DOM; loading this globally is harmless for the
// node-environment logic tests, which never call a DOM matcher.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `@testing-library/react` auto-registers this ONLY when `afterEach` is a
// true global (Jest, or Vitest with `test.globals: true`); this config keeps
// `globals` off so every existing logic test's explicit `import { it } from
// "vitest"` stays unaffected. Without this, a second `render()` in the same
// component test file leaves the first render's DOM nodes in `document.body`,
// and `getByText` starts throwing "multiple elements found".
afterEach(() => {
  cleanup();
});
