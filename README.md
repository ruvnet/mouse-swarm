# Mouse Swarm Reveal

![Animated mouse swarm building a landing page](assets/mouse-swarm-reveal.svg)

Turn a landing page into a visual build sequence. Elements appear in order while a swarm of colored cursors and agent markers moves around them.

[See the live reveal](https://mouse-swarm-reveal.cognitum-consulting-mail.workers.dev/) · [Watch the 9:11 promo](https://ruv-built-by-the-swarm.ruv.chatgpt.site/ruflo-swarm-portrait.mp4) · [Ruflo](https://github.com/ruvnet/ruflo)

**The swarm is simulated.** It does not control a computer, run agents, or report live agent activity.

## Install the skill

From your project directory, run:

```bash
npx skills add ruvnet/mouse-swarm --skill mouse-swarm-reveal -a claude-code -a codex -y --copy
```

This installs the skill and its bundled browser module for both Claude Code and Codex. Use `-a claude-code` or `-a codex` to target one agent. Omit `-y` to review the installer prompts, or add `-g` to install globally. The current `skills` CLI requires Node.js 22.20 or later; check your installed CLI version for its requirements.

Then ask your agent:

> Use the mouse swarm reveal skill to make this landing page build itself in sequence. Include replay and skip controls.

**What is installed**

- A portable `SKILL.md` with the integration and validation workflow.
- A dependency-free browser module in `assets/mouse-swarm.js`.
- A standalone example in `assets/demo.html`.

The installer is a separate tool. Review the skill before use, and use `--copy` when you want independent copies instead of symlinks.

## Use the browser module

The npm registry release is pending. Install the package directly from GitHub:

```bash
npm install github:ruvnet/mouse-swarm
```

Mark elements in the order they appear in the document. Add `data-swarm-type` to a leaf element when its text should appear in chunks.

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

// Optional: reveal.replay() and reveal.destroy()
```

The overlay is pointer transparent and respects reduced motion. Use one instance per root and call `destroy()` when the component unmounts. Avoid marking both a parent and its descendants as reveal targets. Serve `examples/` over HTTP to try the sample without a build tool.

## Video and deployment

The [portrait MP4](https://ruv-built-by-the-swarm.ruv.chatgpt.site/ruflo-swarm-portrait.mp4) is a pre-rendered example, not a recording of live agents. The browser module does not generate video; use a separate recording or rendering workflow when an MP4 is required.

The [live landing page](https://mouse-swarm-reveal.cognitum-consulting-mail.workers.dev/) runs on Cloudflare Workers. Its source is in `site/`. The `mouse.ruv.io` hostname is pending access to the Cloudflare account that controls its DNS zone.

## Development

```bash
npm test
npm pack --dry-run
```

MIT licensed.
