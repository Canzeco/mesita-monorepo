// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Notice, orderNotices } from "./Notice";

describe("Notice", () => {
  it("renders nothing when show is false", () => {
    const { container } = render(
      <Notice show={false} icon={<span />} title="Publish your menu first" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders once, with role=status by default", () => {
    render(<Notice icon={<span />} title="Publish your menu first" />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Publish your menu first")).toBeTruthy();
  });

  it("renders role=alert for tone=bad", () => {
    render(<Notice tone="bad" icon={<span />} title="Badge removed" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("fires its action and renders the action label", () => {
    const onClick = vi.fn();
    render(
      <Notice
        icon={<span />}
        title="Publish your menu first"
        action={{ label: "Open Digital Menu", onClick }}
      />,
    );
    screen.getByRole("button", { name: "Open Digital Menu" }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("goes from rendered to absent when its condition clears (menuPublishedAt flips)", () => {
    let menuPublishedAt: string | null = null;
    const { rerender, container } = render(
      <Notice show={menuPublishedAt === null} icon={<span />} title="Publish your menu first" />,
    );
    expect(screen.getByText("Publish your menu first")).toBeTruthy();

    menuPublishedAt = "2026-09-21";
    rerender(
      <Notice show={menuPublishedAt === null} icon={<span />} title="Publish your menu first" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("orderNotices", () => {
  it("sorts a Locked/error banner (priority 0) ahead of a door Notice (priority 1)", () => {
    const door = { id: "menu-door", priority: 1 };
    const locked = { id: "locked", priority: 0 };
    expect(orderNotices([door, locked])).toEqual([locked, door]);
  });

  it("is stable regardless of input order", () => {
    const a = { id: "a", priority: 0 };
    const b = { id: "b", priority: 1 };
    expect(orderNotices([a, b])).toEqual([a, b]);
    expect(orderNotices([b, a])).toEqual([a, b]);
  });
});
