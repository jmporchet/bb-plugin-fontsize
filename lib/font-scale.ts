// Root font-size control for the bb app shell.
//
// bb's UI is Tailwind with rem-based type scales (`--text-sm: .8125rem`, …)
// and no explicit `html { font-size }`, so the whole app scales off the root
// element. Everything here is per-client on purpose: font size is a property
// of the screen you are looking at, not of the bb server, so it lives in
// localStorage rather than in plugin settings (which are shared by every
// client talking to this server).

export const STORAGE_KEY = "bb-plugin-fontsize:root-px";
export const DEFAULT_ROOT_PX = 16;
export const MIN_ROOT_PX = 11;
export const MAX_ROOT_PX = 26;

/** Fires in the current window whenever this plugin changes the size. */
const CHANGE_EVENT = "bb-plugin-fontsize:change";

export interface FontScalePreset {
  px: number;
  label: string;
}

/** What the sidebar button cycles through. */
export const PRESETS: readonly FontScalePreset[] = [
  { px: 13, label: "Small" },
  { px: 16, label: "Default" },
  { px: 20, label: "Large" },
  { px: 26, label: "Extra large" },
];

export function clampRootFontPx(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_ROOT_PX;
  return Math.min(MAX_ROOT_PX, Math.max(MIN_ROOT_PX, Math.round(px)));
}

/** The stored size for this client, or the default when unset/corrupt. */
export function readRootFontPx(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_ROOT_PX;
    return clampRootFontPx(Number.parseFloat(raw));
  } catch {
    // Private mode, blocked storage — fall back rather than break the shell.
    return DEFAULT_ROOT_PX;
  }
}

function applyRootFontPx(px: number): void {
  document.documentElement.style.setProperty("font-size", `${px}px`);
}

/** Hand the root element back to the browser default. */
export function releaseRootFontPx(): void {
  document.documentElement.style.removeProperty("font-size");
}

/** Persist, apply, and notify this window. Returns the clamped value used. */
export function setRootFontPx(px: number): number {
  const next = clampRootFontPx(px);
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Not persisting is survivable; applying it still is not.
  }
  applyRootFontPx(next);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  return next;
}

/** Re-read storage and apply it. Used on mount and on cross-window writes. */
export function syncRootFontPx(): number {
  const px = readRootFontPx();
  applyRootFontPx(px);
  return px;
}

/**
 * Observe the size from React. Covers same-window changes (the sidebar button)
 * and other windows/tabs writing the same key.
 */
export function subscribeRootFontPx(
  listener: (px: number) => void,
  signal: AbortSignal,
): void {
  const onChange = () => listener(readRootFontPx());
  window.addEventListener(CHANGE_EVENT, onChange, { signal });
  window.addEventListener(
    "storage",
    (event) => {
      if (event.key !== STORAGE_KEY) return;
      onChange();
    },
    { signal },
  );
}

/** The preset one step up from `px`, wrapping back to the smallest. */
export function nextPreset(px: number): FontScalePreset {
  return PRESETS.find((preset) => preset.px > px) ?? PRESETS[0]!;
}

/** A human label for any size, preset or fine-tuned. */
export function describeRootFontPx(px: number): string {
  const preset = PRESETS.find((candidate) => candidate.px === px);
  return preset ? `${preset.label} (${px}px)` : `${px}px`;
}
