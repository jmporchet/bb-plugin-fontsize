// Compensation for bb chrome whose height is a hardcoded pixel value.
//
// Some bb surfaces size themselves in JavaScript with pixel constants that
// assume a 16px root font. The queued-messages panel is the clearest case: its
// height is `min(174, 57 + rows * 33)` in drawer mode. Scale the root font up
// and each row grows past its 33px budget, so the panel's inner scroll
// container clips the last row.
//
// Those heights are written as an inline `style="height: Npx"`, so this module
// watches for them and rewrites them at the same scale as the font. Everything
// here is a workaround against host internals, so it is built to fail quietly:
// if bb stops emitting an inline height, or renames the region, nothing is
// rewritten and the panel simply behaves as it does without this plugin.

import { DEFAULT_ROOT_PX } from "./font-scale";

/**
 * Regions bb sizes in hardcoded pixels. Matched on `aria-label`, which is a
 * user-visible accessibility contract rather than an internal class name, and
 * so is the most stable hook available.
 */
export const COMPENSATED_SELECTOR = 'section[aria-label="Queued messages"]';

/** The root font size bb's pixel constants are written against. */
const BASELINE_ROOT_PX = DEFAULT_ROOT_PX;

/** `"174px"` → `174`; anything else (`""`, `"auto"`, `"50%"`) → null. */
export function parsePxHeight(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (match === null) return null;
  const px = Number.parseFloat(match[1]!);
  return Number.isFinite(px) ? px : null;
}

/** The height a bb-authored pixel constant should take at `rootPx`. */
export function scaleHeightPx(hostHeightPx: number, rootPx: number): number {
  return Math.round((hostHeightPx * rootPx) / BASELINE_ROOT_PX);
}

/** Per-element bookkeeping: what bb asked for, and what we wrote instead. */
interface Tracked {
  /** The last height bb itself set, before scaling. */
  hostHeightPx: number;
  /** The value we wrote, so our own writes are not mistaken for bb's. */
  writtenHeight: string;
}

/**
 * Keep every compensated region scaled to `getRootPx()`.
 *
 * Returns a function that re-applies the current scale, for callers that
 * change the font size. Cleanup is driven entirely by `signal`.
 */
export function installFixedHeightCompensation(
  getRootPx: () => number,
  signal: AbortSignal,
): () => void {
  const tracked = new WeakMap<HTMLElement, Tracked>();
  const observed = new Set<HTMLElement>();
  const attributeObservers = new Map<HTMLElement, MutationObserver>();

  function apply(element: HTMLElement): void {
    const current = element.style.height;
    const record = tracked.get(element);

    // Our own write echoing back through the observer.
    if (record !== undefined && current === record.writtenHeight) return;

    const hostHeightPx =
      current === "" && record !== undefined
        ? // bb cleared the height; nothing left to compensate.
          null
        : parsePxHeight(current);

    if (hostHeightPx === null) {
      tracked.delete(element);
      return;
    }

    const scaled = scaleHeightPx(hostHeightPx, getRootPx());
    const writtenHeight = `${scaled}px`;
    tracked.set(element, { hostHeightPx, writtenHeight });
    if (current !== writtenHeight) element.style.height = writtenHeight;
  }

  /** Re-apply to an element whose bb-authored height has not changed. */
  function reapply(element: HTMLElement): void {
    const record = tracked.get(element);
    if (record === undefined) {
      apply(element);
      return;
    }
    const scaled = scaleHeightPx(record.hostHeightPx, getRootPx());
    const writtenHeight = `${scaled}px`;
    record.writtenHeight = writtenHeight;
    element.style.height = writtenHeight;
  }

  function restore(element: HTMLElement): void {
    const record = tracked.get(element);
    if (record === undefined) return;
    // Only undo our own value; if bb has since written its own, leave it.
    if (element.style.height === record.writtenHeight) {
      element.style.height = `${record.hostHeightPx}px`;
    }
    tracked.delete(element);
  }

  function observe(element: HTMLElement): void {
    if (observed.has(element)) return;
    observed.add(element);
    const observer = new MutationObserver(() => apply(element));
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["style"],
    });
    attributeObservers.set(element, observer);
    apply(element);
  }

  function scan(): void {
    const found = new Set<HTMLElement>();
    for (const element of document.querySelectorAll<HTMLElement>(
      COMPENSATED_SELECTOR,
    )) {
      found.add(element);
      observe(element);
    }
    // Drop regions that have left the DOM (the panel unmounts with no queue).
    for (const element of [...observed]) {
      if (found.has(element) || element.isConnected) continue;
      attributeObservers.get(element)?.disconnect();
      attributeObservers.delete(element);
      observed.delete(element);
    }
  }

  // The panel mounts and unmounts as messages are queued and sent, so watch for
  // it arriving. bb's timeline mutates constantly, so coalesce to one scan per
  // frame rather than one per mutation record.
  let scheduled = 0;
  const treeObserver = new MutationObserver(() => {
    if (scheduled !== 0) return;
    scheduled = window.requestAnimationFrame(() => {
      scheduled = 0;
      scan();
    });
  });
  treeObserver.observe(document.body, { childList: true, subtree: true });

  signal.addEventListener(
    "abort",
    () => {
      if (scheduled !== 0) window.cancelAnimationFrame(scheduled);
      treeObserver.disconnect();
      for (const [element, observer] of attributeObservers) {
        observer.disconnect();
        restore(element);
      }
      attributeObservers.clear();
      observed.clear();
    },
    { once: true },
  );

  scan();

  return () => {
    for (const element of observed) reapply(element);
  };
}
