# Capture a local page as a reveal

Mouse Swarm can render a trusted local HTML page at a chosen viewport, extract visible elements, and create a portable visual reveal. It captures the rendered pixels, so local CSS and images can retain their appearance. It is a static reconstruction of one viewport; the original DOM, links, forms, responsive behavior, and source scripts are not exported.

## Set up

Install the GitHub package, Playwright 1.48 or later, a matching Chromium browser, and FFmpeg with libx264 for MP4 export:

```bash
npm install github:ruvnet/mouse-swarm playwright
npx playwright install chromium
```

## Capture and reorder

Use HTML and local assets that you own or are authorized to use:

```bash
npx mouse-swarm-capture --input ./page.html --output ./captured-page --preset portrait
python3 -m http.server 8000 --directory ./captured-page
```

Open `http://localhost:8000`, select **Edit sequence**, move items up or down, and choose **Apply and replay**. To keep the sequence for a later export, select **Download sequence.js**, then replace the `sequence.js` in the capture directory with the downloaded file. Stop the local server with Ctrl+C.

The output directory must not already exist. The command writes the page reconstruction, two screenshots, a manifest with extracted labels and coordinates, the sequence file, and a copy of the reveal module. Screenshots and labels may contain sensitive page content; inspect them before sharing.

## Export an MP4

```bash
npx mouse-swarm-video --input ./captured-page/index.html --output ./reveal.mp4 --preset portrait
```

Portrait uses 1080 × 1320, a 9:11 aspect ratio. The exported video shows simulated cursors and does not imply agent activity. If you downloaded a reordered sequence, replace `sequence.js` first. For browser selection, timing, encoding, and other options, see the [Playwright guide](playwright.md).

## Capture settings

| Option | Default | Purpose |
| --- | --- | --- |
| `--preset` | `desktop` | `desktop` is 1280 × 800; `portrait` is 1080 × 1320. |
| `--width`, `--height` | Preset size | Viewport dimensions from 320 to 1920 pixels. |
| `--selector` | Common visible page elements | CSS selector for capture targets. |
| `--max-targets` | `100` | Limit captured items to 1 through 200. |
| `--cursors` | `20` | Simulated cursor count from 0 to 80. |
| `--interval` | `280` | Milliseconds between reveal steps, from 20 to 10000. |
| `--wait-ms` | `0` | Wait after load before capture, up to 10000 ms. |
| `--browser-executable` | Playwright Chromium | Optional browser executable path. |
| `--allow-scripts` | Off | Run scripts only for explicitly trusted local content. |

Scripts are disabled by default. A JavaScript-rendered page may appear incomplete unless script execution is explicitly enabled. The capture serves assets from the input directory, blocks cross-origin HTTP requests and WebSockets, and disables service workers and downloads. It is not a security sandbox. Do not use untrusted HTML. External fonts, images, and other remote resources are unavailable and may alter the appearance. URL capture is not implemented; save an authorized local copy with its assets first.

The page is reconstructed from screenshot fragments, so overlaps, transparency, animations, and complex layouts can produce imperfect results. Only visible elements in the selected viewport are included. Review the capture and sequence before publishing or exporting.
