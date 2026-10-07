---
"@ikaros-arch/3dhop": minor
"@ikaros-arch/react-3dhop": minor
---

Toolbar controls can now render arbitrary React content as their icon (e.g. an icon-font `<i>` element), not only an image URL.

Every built-in control's `icon` prop (and `ToggleIcons.enabled`/`disabled`) now accepts `string | React.ReactNode`: a string is still resolved as an image URL against `assetBaseUrl` exactly as before, and anything else renders as-is inside the toolbar's icon slot. `ToggleImageConfig` (used by `ToggleImagePair` for custom controls) gains the same behavior via a new `icon` field, which replaces the old `src: string` field — update any direct `ToggleImageConfig` construction accordingly.

New exported helper `resolveControlIcon(assetBaseUrl, override, fallback)` mirrors `resolveToggleIcon` but is ReactNode-aware, for building custom controls with the same fallback behavior as the built-ins.

The vendored `@ikaros-arch/3dhop` runtime's `init.js` toolbar hover/mousedown/mouseup/touch wiring and opacity sync previously matched `#toolbar img`, hardcoding the assumption that every toolbar icon is an `<img>`. Both now match `#toolbar [data-hop-id]` instead (an attribute every toolbar icon already carries, image or not), so non-image icon content gets identical interaction behavior. No markup changes are needed for existing `<img>`-based toolbars.
