---
name: mouse-swarm-reveal
description: Create or integrate an animated landing page reveal with simulated mouse cursors and agent markers. Use when asked for a swarm-built page, cursor choreography, sequential element reveal, or a landing page in which simulated agents appear to assemble content.
---

# Mouse Swarm Reveal

Build a production-quality page first, using the project's existing framework and styles. Treat the swarm as a visual simulation, not evidence of live agents or computer use.

1. Identify the actual content, destination links, branding, and permission to use any third-party assets. Preserve the existing page's semantics and responsiveness.
2. Mark meaningful elements in the intended build order with `data-swarm-item`. Avoid overlapping parent and child targets. Add `data-swarm-type` only to leaf elements whose text should appear in small chunks.
3. Use the bundled `assets/mouse-swarm.js` or the npm package `@ruvector/mouse-swarm`. For static sites copy the bundled module into a served assets directory and import it with `<script type="module">`. For bundled apps import `createSwarmReveal` from the package. Initialize after the DOM exists:

```js
import { createSwarmReveal } from '@ruvector/mouse-swarm';
const reveal = createSwarmReveal({ root: document, cursors: 20, interval: 280 });
reveal.start();
// Expose accessible controls as needed: reveal.replay(), reveal.skip(), reveal.destroy().
```

4. Add visible replay and skip controls. Respect reduced motion, keyboard use, mobile layouts, and user scrolling. Keep the overlay pointer transparent. Avoid blocking navigation or requiring animation to finish before use.
5. Test the initial reveal, final content, replay, skip, reduced motion, narrow layout, and navigation. Call `destroy()` during framework unmount. Verify any requested video export separately; this module does not generate MP4 files.

Do not copy an external site wholesale without permission. Do not send captured content or collect visitor data. Describe the cursors as simulated unless connected to verified live agent events.
