---
name: mouse-swarm-reveal
description: Build or integrate a sequential landing page reveal with simulated mouse cursors and agent markers. Use when asked for a swarm-built website, cursor choreography, or a page that appears to be assembled by multiple agents.
---

# Mouse Swarm Reveal

Create the complete, usable page first. The cursors are a visual simulation, not live agents or computer control. Never imply otherwise without verified event data.

## Workflow

1. Inspect the project instructions, framework, entry point, existing styles, and available assets. Identify the content, brand, links, and intended reveal sequence. Reuse assets only when authorized.
2. Add `data-swarm-item` to meaningful elements in document order. Keep targets at one hierarchy level: marking a parent and its descendants can hide content unexpectedly. Add `data-swarm-type` only to leaf elements with plain text; the module replaces their text temporarily during the animation.
3. Integrate the bundled `assets/mouse-swarm.js`. For a static site, copy it into a public assets directory and import it as a browser ES module. For a bundled app, install the repository package with `npm install github:ruvnet/mouse-swarm` and import from `@ruvector/mouse-swarm`.
4. Initialize after the target DOM exists. Expose keyboard-accessible replay and skip controls that stay visible throughout the reveal. In component frameworks, call `destroy()` on unmount.

```js
import { createSwarmReveal } from '@ruvector/mouse-swarm';

const reveal = createSwarmReveal({ root: document, cursors: 20, interval: 280 });
reveal.start();
// Connect controls to reveal.replay() and reveal.skip().
// Call reveal.destroy() during cleanup.
```

For static sites, replace the import path with the served path to the copied module. `assets/demo.html` is a minimal reference; use the project's own content and design.

## Validation

- Check the initial sequence, final page, replay, skip, and teardown. Confirm that links and controls remain usable and the overlay does not intercept clicks.
- Check narrow and wide viewports and reduced motion. Keep content readable without JavaScript and avoid forcing the user's scroll position.
- Preserve the original text, HTML semantics, and destination links. Never collect visitor data or send content elsewhere as part of the effect.
- If video is requested, use a separate screen recording or rendering workflow and verify the requested format and dimensions. This module does not create MP4 files.

Do not copy third-party websites or assets without permission. Describe animated cursors as simulated unless they are backed by verified live agent events.
