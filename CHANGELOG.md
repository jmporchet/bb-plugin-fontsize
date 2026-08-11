# Changelog

## 0.2.0

- Widen the presets to 13 / 16 / 20 / 26px, from 13 / 16 / 18 / 20px. Large and
  Extra large now step further apart.
- Raise the fine-control ceiling from 24px to 26px so Extra large is reachable.

Your saved size is untouched. If you were on the old Extra large (20px) it is
now Large, and one more click on the sidebar button reaches the new 26px.

## 0.1.1

- Fix the queued-messages panel clipping its last message at larger font sizes.
  bb sizes that panel with pixel constants that assume a 16px root
  (`min(174, 57 + rows * 33)` in drawer mode), so it did not grow with the
  font. Its inline height is now rescaled to match, and restored on dispose.

## 0.1.0

Initial release.

- Sidebar footer button cycling Small (13px) → Default (16px) → Large (18px) →
  Extra large (20px).
- Settings section with the presets plus ±1px fine control (11–24px) and Reset.
- Size is per device (`localStorage`), synced across bb windows on the same
  machine.
- Ships its own `Aa` branding icon; bb's icon registry has no text/font glyph.
