// bb-plugin-fontsize — frontend entry.
//
// Three surfaces:
//   1. a content script that applies the stored root font-size to the app shell
//   2. a sidebar footer button that cycles Small → Default → Large → XL
//   3. a settings section with the presets plus fine-grained ±1px control
import { useEffect, useState } from "react";
import { definePluginApp } from "@bb/plugin-sdk/app";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_ROOT_PX,
  MAX_ROOT_PX,
  MIN_ROOT_PX,
  PRESETS,
  STORAGE_KEY,
  describeRootFontPx,
  nextPreset,
  readRootFontPx,
  releaseRootFontPx,
  setRootFontPx,
  subscribeRootFontPx,
  syncRootFontPx,
} from "@/lib/font-scale";

/** Live root font-size for this window, kept in sync with other windows. */
function useRootFontPx(): number {
  const [px, setPx] = useState(readRootFontPx);
  useEffect(() => {
    const controller = new AbortController();
    subscribeRootFontPx(setPx, controller.signal);
    // Another window may have written while this component was unmounted.
    setPx(readRootFontPx());
    return () => controller.abort();
  }, []);
  return px;
}

function FontSizeSettings() {
  const px = useRootFontPx();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.px}
            size="sm"
            variant={preset.px === px ? "default" : "outline"}
            aria-pressed={preset.px === px}
            onClick={() => setRootFontPx(preset.px)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          aria-label="Decrease font size"
          disabled={px <= MIN_ROOT_PX}
          onClick={() => setRootFontPx(px - 1)}
        >
          −
        </Button>
        <span className="min-w-24 text-center text-sm tabular-nums text-muted-foreground">
          {describeRootFontPx(px)}
        </span>
        <Button
          size="sm"
          variant="outline"
          aria-label="Increase font size"
          disabled={px >= MAX_ROOT_PX}
          onClick={() => setRootFontPx(px + 1)}
        >
          +
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={px === DEFAULT_ROOT_PX}
          onClick={() => setRootFontPx(DEFAULT_ROOT_PX)}
        >
          Reset
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Scales the whole bb interface by setting the root font size. This is a
        per-device preference stored in this client&rsquo;s local storage
        (<code className="text-xs">{STORAGE_KEY}</code>), not a server setting,
        so each machine you use bb from keeps its own size.
      </p>
    </div>
  );
}

export default definePluginApp((app) => {
  // Trusted same-origin page code: the only way to reach the app shell's root
  // element, since the SDK exposes no font-size API. The disposer must put the
  // root element back, or disabling the plugin would leave the app rescaled.
  app.contentScripts.register({
    id: "apply-root-font-size",
    mount({ signal }) {
      syncRootFontPx();
      // Keep this window in step when another bb window changes the size.
      window.addEventListener(
        "storage",
        (event) => {
          if (event.key !== STORAGE_KEY) return;
          syncRootFontPx();
        },
        { signal },
      );
      return () => releaseRootFontPx();
    },
  });

  // Host-rendered icon button in the sidebar footer, in the same group as the
  // connect plugin's "Remote access". `run` gets no anchor element, so there is
  // no popover to open from here — one click steps to the next preset.
  app.slots.sidebarFooterAction({
    id: "cycle",
    title: "Font size",
    // Fallback only: the plugin's own branding SVG wins on compact surfaces,
    // and the host icon registry has no text/font glyph to name here.
    icon: "AlignLeft",
    run: ({ openSettings }) => {
      const preset = nextPreset(readRootFontPx());
      setRootFontPx(preset.px);
      toast.success(`Font size: ${preset.label}`, {
        description: `${preset.px}px root size`,
        action: { label: "More sizes", onClick: () => openSettings() },
      });
    },
  });

  app.slots.settingsSection({
    id: "size",
    title: "Interface font size",
    description: "Scale every part of the bb interface on this device.",
    component: FontSizeSettings,
  });
});
