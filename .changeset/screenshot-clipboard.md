---
"@ikaros-arch/react-3dhop": minor
---

`ScreenshotControl` gains `copyToClipboard`, `download`, `baseName`, `withTime`, `onScreenshot` and `onError` props; when any is set the control captures via 3DHOP's `saveScreenshot()` frame and copies / renames / hands over the PNG itself. The helpers `captureScreenshot`, `copyImageToClipboard`, `dataUrlToBlob`, `downloadDataUrl` and `screenshotFileName` are exported. Clipboard copying ported from the BITFROST viewer.
