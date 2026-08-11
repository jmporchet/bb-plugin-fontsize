// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPENSATED_SELECTOR,
  installFixedHeightCompensation,
  parsePxHeight,
  scaleHeightPx,
} from "./fixed-height-compensation";

describe("parsePxHeight", () => {
  it("reads a pixel height", () => {
    expect(parsePxHeight("174px")).toBe(174);
    expect(parsePxHeight(" 90px ")).toBe(90);
    expect(parsePxHeight("41.5px")).toBe(41.5);
  });

  it("ignores anything that is not a plain pixel height", () => {
    for (const value of ["", "auto", "50%", "10rem", "calc(100% - 4px)"]) {
      expect(parsePxHeight(value)).toBeNull();
    }
  });
});

describe("scaleHeightPx", () => {
  it("is a no-op at the baseline root size", () => {
    expect(scaleHeightPx(174, 16)).toBe(174);
  });

  it("grows and shrinks with the root size", () => {
    // bb's drawer formula for one queued row: 57 + 33.
    expect(scaleHeightPx(90, 20)).toBe(113);
    expect(scaleHeightPx(90, 13)).toBe(73);
  });
});

describe("installFixedHeightCompensation", () => {
  let controller: AbortController;
  let rootPx: number;

  /**
   * jsdom has no layout loop. MutationObserver records arrive on a microtask,
   * and the tree observer coalesces them into one requestAnimationFrame, so a
   * settle is: deliver records, run the frame, then let the scan's work land.
   */
  async function settle(): Promise<void> {
    await Promise.resolve();
    vi.advanceTimersByTime(32);
    await Promise.resolve();
  }

  function addPanel(height: string): HTMLElement {
    const section = document.createElement("section");
    section.setAttribute("aria-label", "Queued messages");
    section.style.height = height;
    document.body.append(section);
    return section;
  }

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "setTimeout",
        "clearTimeout",
      ],
    });
    document.body.innerHTML = "";
    controller = new AbortController();
    rootPx = 16;
  });

  afterEach(() => {
    controller.abort();
    vi.useRealTimers();
  });

  function install() {
    return installFixedHeightCompensation(() => rootPx, controller.signal);
  }

  it("scales a panel that is already mounted", () => {
    const panel = addPanel("90px");
    rootPx = 20;
    install();
    expect(panel.style.height).toBe("113px");
  });

  it("leaves the panel alone at the default size", () => {
    const panel = addPanel("90px");
    install();
    expect(panel.style.height).toBe("90px");
  });

  it("scales a panel that mounts later", async () => {
    rootPx = 20;
    install();
    const panel = addPanel("90px");
    await settle();
    expect(panel.style.height).toBe("113px");
  });

  it("rescales when bb changes its own height", async () => {
    const panel = addPanel("90px");
    rootPx = 20;
    install();
    expect(panel.style.height).toBe("113px");

    // A second queued message: bb recomputes 57 + 2 * 33.
    panel.style.height = "123px";
    await Promise.resolve();
    expect(panel.style.height).toBe("154px");
  });

  it("does not compound its own writes", async () => {
    const panel = addPanel("90px");
    rootPx = 20;
    install();
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(panel.style.height).toBe("113px");
  });

  it("rescales on demand when the font size changes", () => {
    const panel = addPanel("90px");
    const rescale = install();
    expect(panel.style.height).toBe("90px");

    rootPx = 20;
    rescale();
    expect(panel.style.height).toBe("113px");

    rootPx = 13;
    rescale();
    expect(panel.style.height).toBe("73px");
  });

  it("restores bb's own height on abort", () => {
    const panel = addPanel("90px");
    rootPx = 20;
    install();
    expect(panel.style.height).toBe("113px");

    controller.abort();
    expect(panel.style.height).toBe("90px");
  });

  it("ignores a region with no inline pixel height", () => {
    const panel = addPanel("");
    rootPx = 20;
    install();
    expect(panel.style.height).toBe("");
  });

  it("only touches the compensated region", () => {
    const other = document.createElement("section");
    other.setAttribute("aria-label", "Something else");
    other.style.height = "90px";
    document.body.append(other);
    rootPx = 20;
    install();
    expect(other.style.height).toBe("90px");
    expect(document.querySelectorAll(COMPENSATED_SELECTOR)).toHaveLength(0);
  });
});
