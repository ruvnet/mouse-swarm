---
name: mouse-swarm-reveal
description: Build a sequential website reveal with simulated cursor swarms, or add a local Ruflo agent status view. Use for a swarm-built landing page, cursor choreography, agent-themed product demo, reveal controls, or verified read-only Ruflo status integration.
---

# Mouse Swarm Reveal

Create the complete, usable page first. Choose the mode explicitly:

- **Reveal:** simulated cursors choreograph a sequential presentation. They are not agents, computer input, or telemetry.
- **Ruflo observation:** the local bridge reports agent registrations and statuses from the CLI. It does not start agents, prove task execution, or supply cursor coordinates.
- **Both:** keep the visual reveal and observed status clearly labeled and separate. Only show a live marker when the trusted source actually supplies its coordinates.

Use `assets/demo.html` for the existing working reference. The bundled browser modules are self-contained and have no runtime dependencies.

## Workflow

1. Inspect the project instructions, framework, entry point, existing styles, and available assets. Identify the content, brand, links, and intended reveal sequence. Reuse assets only when authorized. If given a URL, work from authorized content and available source; do not assume the site permits cross-origin fetching or reproduce third-party assets without permission.
2. Add `data-swarm-item` to meaningful elements in document order. Keep targets at one hierarchy level: marking a parent and its descendants can hide content unexpectedly. Add `data-swarm-type` only to leaf elements with plain text; the module replaces their text temporarily during the animation.
3. Integrate the bundled `assets/mouse-swarm.js`. For a static site, copy it into a public assets directory and import it as a browser ES module. For a bundled app, install the repository package with `npm install github:ruvnet/mouse-swarm` and import from `@ruvector/mouse-swarm`.
4. Initialize after the target DOM exists. The module captures targets at initialization, so recreate the instance after a material target list change. Configure cursor count, colors, labels, size, motion speed, bot frequency, selection outline, typing cadence, and optional scrolling to suit the project. Expose keyboard-accessible replay, pause, resume, and skip controls that stay visible throughout the reveal. In component frameworks, call `destroy()` on unmount.

```js
import { createSwarmReveal } from '@ruvector/mouse-swarm';

const reveal = createSwarmReveal({
  root: document, cursors: 24, interval: 200,
  colors: ['#c8f578', '#70c9f9', '#c9acff'],
  labels: ['Scout', 'Builder', 'Reviewer'], botEvery: 4,
  cursorSize: 18, cursorSpeed: 600, selection: true,
  typeText: true, typeWords: 2, autoScroll: false,
  onStep: ({ current, total }) => { /* update progress */ },
  onError: (error) => { /* report the failure */ }
});
reveal.start();
// Connect controls to reveal.replay(), reveal.pause(), reveal.resume(), and reveal.skip().
// Read reveal.getState() for status and progress.
// Call reveal.destroy() during cleanup.
```

For static sites, copy `assets/mouse-swarm.js` into a served project directory and replace the import path with that served module path. Serve the site over HTTP; browsers do not resolve bare package names without a bundler or import map. `assets/demo.html` is an interactive configuration reference; use the project's own content and design. Targets cannot be shared by simultaneous instances from the same module. An animation or callback error restores content and reports through `onError`.

## Sequencing and interaction

- Mark individual visual units rather than an entire section. Use DOM order for header, headline, supporting copy, cards, and final action; use short leaf text for typed steps. Do not mark nested targets.
- Keep replay, pause, resume, and skip outside the selected content. Do not cover interactive elements or hijack scrolling. Use `onStep` for progress and `onComplete` to restore UI state; inspect `getState()` for status and counts.
- Use `destroy()` before recreating an instance or unmounting a component. Preserve the page's semantics and no-JavaScript content. Respect reduced motion and let the module restore content on errors.
- For browser capture, specify dimensions and duration, then record or render using a separate tool. Verify the resulting file and format. Do not present a prerecorded demonstration as a live swarm.

## Ruflo integration

For observed state, prefer the opt in loopback example: run `npx --yes --package=github:ruvnet/mouse-swarm mouse-swarm observe` from the intended Ruflo project and open the printed local URL. It reads agent registrations and status using the local Ruflo CLI; it does not start agents, control a computer, or report cursor positions. Do not expose that server publicly.

For a custom host, use `@ruvector/mouse-swarm/ruflo` and `@ruvector/mouse-swarm/ruflo-view`, or copy the corresponding bundled assets into the project. The host must authenticate, authorize, minimize, and normalize events. Supply coordinates only when they were actually observed. Do not put secrets, raw task descriptions, or private agent data into a public landing page. Display status provenance and stale or error state; do not infer execution from registration. The adapter does not perform network calls or execute tasks.

For a complete authenticated snapshot, validate and map source records to `agent.upsert` events and use `adapter.replaceAgents(events)` once per successful poll. For incremental updates use `adapter.ingest(event)` with monotonically increasing per-agent revisions when the source supports them. The view supports `unverified`, `connected`, `stale`, `error`, and `disconnected`: report connected only after the source succeeds, and mark a failed poll stale or error. Equal snapshot revisions retain prior data. Removal revision history is bounded to twice `maxAgents`, so the source must also prevent delayed events after eviction. Destroy the view and dispose the adapter during teardown.

The local bridge polls only the agent list and excludes task bodies, prompts, and credentials. Custom adapters may accept `task.update` events, but task titles are hidden by default and must not be published without authorization. Do not label illustrative events as native Ruflo wire events.

## Validation

- Check the initial sequence, final page, replay, pause, resume, skip, and teardown. Confirm the controls remain usable during the reveal and no target is owned by a second active instance. Validate custom values and progress callbacks. Confirm that links and controls remain usable and the overlay does not intercept clicks.
- Check narrow and wide viewports, reduced motion changes during playback, callback failures, and keyboard focus while targets are hidden. Keep content readable without JavaScript and avoid forcing the user's scroll position.
- Preserve the original text, HTML semantics, and destination links. Never collect visitor data or send content elsewhere as part of the effect.
- For observation, verify the CLI responds in the intended project, source failure is visible, and an empty list is shown honestly. Test with actual events when available; never claim a live swarm was verified using a fabricated fixture.
- If video is requested, use a separate screen recording or rendering workflow and verify the requested format and dimensions. This module does not create MP4 files.

Do not copy third-party websites or assets without permission. Describe animated cursors as simulated unless they are backed by verified live agent events.
