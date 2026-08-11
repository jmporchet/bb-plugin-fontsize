# Changelog

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
