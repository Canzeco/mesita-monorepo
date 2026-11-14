import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import {
  ConfirmPanel,
  confirmReducer,
  escapeCloses,
  runConfirm,
  type ConfirmEvent,
  type ConfirmState,
} from "./dialog";
import { SaveBar } from "./save";

// MESITA-3948 kit pins. MVP test rule: these guard data loss and destructive
// actions, not looks. The app runs vitest in node (no DOM), so clicks are
// driven through the element tree and the dialog's state machine directly.

type Props = { children?: ReactNode; onClick?: () => void; disabled?: boolean };

function findAll(node: ReactNode, pred: (el: ReactElement<Props>) => boolean): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((n) => findAll(n, pred));
  if (!isValidElement<Props>(node)) return [];
  return [...(pred(node) ? [node] : []), ...findAll(node.props.children, pred)];
}

describe("SaveBar (MESITA-737: never save over a config that failed to load)", () => {
  const props = {
    loadError: "admin-web-get-config failed",
    dirty: true,
    ok: false,
    pending: false,
    lastChanged: null,
    error: null,
    onDiscard: () => {},
  };

  it("renders Save disabled and says why", () => {
    const html = renderToStaticMarkup(<SaveBar {...props} onSave={() => {}} />);
    expect(html).toContain("Save disabled — a config failed to load");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save<\/button>/);
  });

  it("never calls onSave, even if the click reaches the button", () => {
    const onSave = vi.fn();
    const tree = SaveBar({ ...props, onSave });
    const [save] = findAll(tree, (el) => el.type === Button && el.props.children === "Save");
    expect(save.props.disabled).toBe(true);
    save.props.onClick?.();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("ConfirmDialog (a destructive confirm that fails stays open and retryable)", () => {
  const copy = { title: "Reset the database?", body: "Every place is deleted.", confirmLabel: "Reset", danger: true };

  it("disables Cancel and Esc while the action runs", () => {
    const html = renderToStaticMarkup(
      <ConfirmPanel {...copy} pending error={null} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Cancel<\/button>/);
    expect(escapeCloses(true)).toBe(false);
    expect(escapeCloses(false)).toBe(true);
  });

  it("turns a rejected action into an in-dialog error and re-enables both buttons", async () => {
    let state: ConfirmState = { pending: false, error: null };
    const seen: ConfirmEvent["type"][] = [];
    const dispatch = (e: ConfirmEvent) => {
      seen.push(e.type);
      state = confirmReducer(state, e);
    };
    const outcome = await runConfirm(() => Promise.reject(new Error("reset failed: 500")), dispatch);
    expect(outcome).toBe("failed");
    expect(seen).toEqual(["start", "fail"]);
    expect(state).toEqual({ pending: false, error: "reset failed: 500" });

    const html = renderToStaticMarkup(
      <ConfirmPanel {...copy} pending={state.pending} error={state.error} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("reset failed: 500");
    expect(html).not.toContain('disabled=""');
  });
});

describe("Button type", () => {
  it('defaults to type="button" so a button inside a form never submits it', () => {
    expect(renderToStaticMarkup(<Button>Go</Button>)).toContain('type="button"');
  });

  it('passes type="submit" through, keeping Enter-to-submit', () => {
    expect(renderToStaticMarkup(<Button type="submit">Search</Button>)).toContain('type="submit"');
  });
});
