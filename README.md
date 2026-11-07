# Mouse Swarm Reveal

Build a landing page as a sequence of visible elements while simulated cursors and agent markers move around it. This package includes a dependency-free browser module and one portable skill that works with Claude Code and Codex.

[View the Ruflo reveal](https://ruv-built-by-the-swarm.ruv.chatgpt.site/) · [Watch the 9:11 example video](https://ruv-built-by-the-swarm.ruv.chatgpt.site/ruflo-swarm-portrait.mp4)

The cursors are an animation. They are not actual agent actions, telemetry, or computer control.

**Registry status:** The npm registry release is pending. Install from GitHub using the commands below.

## Install the skill

From your project directory:

```sh
npx --yes --package=github:ruvnet/mouse-swarm- mouse-swarm init
```

This installs the skill and its bundled browser module in `.claude/skills/mouse-swarm-reveal` and `.agents/skills/mouse-swarm-reveal`. Use `--claude` or `--codex` to install only one. Existing directories are protected unless `--force` is provided; back up your edits before using it.

Ask your agent: “Use the mouse swarm reveal skill to animate this landing page.” The skill includes a standalone HTML example under `assets/`.

## Use the browser module

```sh
npm install github:ruvnet/mouse-swarm-
```

```html
<h1 data-swarm-item data-swarm-type>Build something together.</h1>
<p data-swarm-item data-swarm-type>Give ideas room to grow.</p>
<button id="skip">Skip animation</button>
```

```js
import { createSwarmReveal } from '@ruvector/mouse-swarm';
const reveal = createSwarmReveal({ cursors: 20, interval: 280 });
document.querySelector('#skip').addEventListener('click', reveal.skip);
reveal.start();
// reveal.replay() and reveal.destroy() are also available.
```

The markup targets are selected in document order. `data-swarm-type` types text in groups of words on leaf elements only. Avoid marking both a parent and its descendants. The overlay is pointer transparent, does not collect visitor data, and honors reduced motion. Use one instance per root and call `destroy()` when removing a component. Without JavaScript, unmodified content remains visible.

For a plain HTML project, copy `skills/mouse-swarm-reveal/assets/mouse-swarm.js` to a public assets folder and import it as an ES module. Serve `examples/` over HTTP to run the included sample.

## Video

The linked portrait MP4 is an example asset, not a recording of live agents. The browser module does not produce video; use a screen recorder or a separate rendering pipeline for video exports. Do not misrepresent simulated activity as operational telemetry.

## Development

```sh
npm test
npm pack --dry-run
```

MIT licensed.
