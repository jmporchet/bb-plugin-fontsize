// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ROOT_PX,
  MAX_ROOT_PX,
  MIN_ROOT_PX,
  PRESETS,
  STORAGE_KEY,
  clampRootFontPx,
  describeRootFontPx,
  nextPreset,
  readRootFontPx,
  releaseRootFontPx,
  setRootFontPx,
  subscribeRootFontPx,
  syncRootFontPx,
} from "./font-scale";

const rootStyle = () => document.documentElement.style.fontSize;

beforeEach(() => {
  window.localStorage.clear();
  releaseRootFontPx();
});

describe("clampRootFontPx", () => {
  it("keeps sizes inside the supported range", () => {
    expect(clampRootFontPx(MIN_ROOT_PX - 5)).toBe(MIN_ROOT_PX);
    expect(clampRootFontPx(MAX_ROOT_PX + 5)).toBe(MAX_ROOT_PX);
    expect(clampRootFontPx(15)).toBe(15);
  });

  it("rounds fractional sizes and rejects non-numbers", () => {
    expect(clampRootFontPx(15.4)).toBe(15);
    expect(clampRootFontPx(Number.NaN)).toBe(DEFAULT_ROOT_PX);
    expect(clampRootFontPx(Number.POSITIVE_INFINITY)).toBe(DEFAULT_ROOT_PX);
  });
});

describe("readRootFontPx", () => {
  it("defaults when nothing is stored", () => {
    expect(readRootFontPx()).toBe(DEFAULT_ROOT_PX);
  });

  it("defaults when the stored value is corrupt", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-a-number");
    expect(readRootFontPx()).toBe(DEFAULT_ROOT_PX);
  });

  it("clamps an out-of-range stored value", () => {
    window.localStorage.setItem(STORAGE_KEY, "999");
    expect(readRootFontPx()).toBe(MAX_ROOT_PX);
  });
});

describe("setRootFontPx", () => {
  it("persists and applies the clamped size", () => {
    expect(setRootFontPx(18)).toBe(18);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("18");
    expect(rootStyle()).toBe("18px");
  });

  it("applies the clamp before writing", () => {
    expect(setRootFontPx(2)).toBe(MIN_ROOT_PX);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(MIN_ROOT_PX));
  });
});

describe("syncRootFontPx / releaseRootFontPx", () => {
  it("applies what another window stored", () => {
    window.localStorage.setItem(STORAGE_KEY, "13");
    expect(syncRootFontPx()).toBe(13);
    expect(rootStyle()).toBe("13px");
  });

  it("hands the root element back to the browser default", () => {
    setRootFontPx(20);
    releaseRootFontPx();
    expect(rootStyle()).toBe("");
  });
});

describe("subscribeRootFontPx", () => {
  it("reports same-window changes and stops on abort", () => {
    const seen: number[] = [];
    const controller = new AbortController();
    subscribeRootFontPx((px) => seen.push(px), controller.signal);

    setRootFontPx(18);
    expect(seen).toEqual([18]);

    controller.abort();
    setRootFontPx(13);
    expect(seen).toEqual([18]);
  });

  it("reports a write from another window", () => {
    const seen: number[] = [];
    const controller = new AbortController();
    subscribeRootFontPx((px) => seen.push(px), controller.signal);

    window.localStorage.setItem(STORAGE_KEY, "20");
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(seen).toEqual([20]);

    // An unrelated key must not wake the listener.
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(seen).toEqual([20]);
    controller.abort();
  });
});

describe("nextPreset", () => {
  it("steps up through the presets", () => {
    expect(nextPreset(13).px).toBe(16);
    expect(nextPreset(16).px).toBe(20);
    expect(nextPreset(20).px).toBe(26);
  });

  it("wraps to the smallest preset from the largest", () => {
    expect(nextPreset(26).px).toBe(PRESETS[0]!.px);
    expect(nextPreset(MAX_ROOT_PX).px).toBe(PRESETS[0]!.px);
  });

  it("steps up from a fine-tuned size that is not a preset", () => {
    expect(nextPreset(14).px).toBe(16);
    expect(nextPreset(11).px).toBe(13);
    expect(nextPreset(18).px).toBe(20);
  });

  it("keeps every preset reachable within the supported range", () => {
    for (const preset of PRESETS) {
      expect(clampRootFontPx(preset.px)).toBe(preset.px);
    }
  });
});

describe("describeRootFontPx", () => {
  it("names presets and falls back to raw px", () => {
    expect(describeRootFontPx(16)).toBe("Default (16px)");
    expect(describeRootFontPx(15)).toBe("15px");
  });
});
