# Activity, MetaHarness, studio, and video

## Record Ruflo observations

Start the local observer from the intended Ruflo project as described in the [Ruflo guide](ruflo-user-guide.md). Choose **Start recording** before the activity you want to observe. Successful snapshots create a bounded in-memory timeline of initial agents and subsequent observed changes. Choose **Stop recording**, then **Replay** or **Download JSON**. Use **Load JSON** to reopen a previously saved recording. Pause and resume replay with the playback control. Closing the page discards an unsaved recording.

Each entry has an observation timestamp, a sequence number, and source provenance. The snapshot mode reports what changed between polls. It cannot establish the exact transition time or capture changes that occurred and reverted between polls. It does not prove an agent executed work. An `agent.remove` observation means an agent was absent from a later successful filtered list; it does not prove deletion. The recorder excludes task titles, prompts, labels, and coordinates, but agent IDs and source references are still included. Treat exported recordings as potentially sensitive.

The current Ruflo task listing can omit assigned `in_progress` tasks. The observer does not infer task completion from task absence; it records agent snapshot changes only. Failed polls are not recorded as removals.

## MetaHarness adapter

The MetaHarness adapter accepts host-supplied native session envelopes with `index`, `branch`, `kind`, and `payload`. It requires an explicit mapper because those envelopes do not guarantee agent IDs, timestamps, or shared task semantics. The host must verify the source and supply the meaning of its own event kinds. The recorded time is the local observation time. Raw payloads are not retained by the adapter.

```js
import {createActivityRecorder} from '@ruvector/mouse-swarm/activity';
import {createMetaHarnessAdapter} from '@ruvector/mouse-swarm/metaharness';

const recorder = createActivityRecorder({maxEvents: 1000});
const adapter = createMetaHarnessAdapter({
  sourceId: 'local-session',
  // Example application-defined kind. It is not a built-in MetaHarness kind.
  mapEvent: event => event.kind === 'app.agent.status'
    ? {type: 'agent.upsert', id: event.payload.agentId, status: event.payload.status}
    : null,
  record: observation => recorder.record(observation)
});

// Pass only authenticated session envelopes from your own integration.
// adapter.ingest(sessionEvent);
// Or, in Node.js, import a complete local MetaHarness SessionLog:
// import {importMetaHarnessSessionFile} from '@ruvector/mouse-swarm/metaharness-file';
// await importMetaHarnessSessionFile({path: '/path/to/session.jsonl', adapter});
// Later: adapter.dispose(); recorder.dispose();
```

The optional Node-only file reader imports an explicitly selected, complete local session JSONL file with bounded size and structural checks. It does not verify source authenticity or state hashes; an incomplete last line fails, so read a completed snapshot. If mapping fails partway through, earlier mapped records remain committed. This adapter does not discover sessions, subscribe to a native feed, execute agents, or authenticate a source. It requires monotonically increasing indices within each branch. Free-form payloads can contain private data; only map the fields your application is authorized to retain. The adapter follows the [MetaHarness session envelope](https://github.com/ruvnet/metaharness/blob/574ce3b881e902d23472a541f9f9e2fdccfa63db/packages/kernel-js/src/session.ts).

When combining sources, namespace agent IDs in the host mapper so identical IDs from separate sources do not merge into one replayed agent. Source references are labels supplied by the host, not cryptographic proof.

## Studio

Serve the repository over HTTP and open `examples/studio.html`. The studio configures a bundled sample page or imports a local HTML file as a text-only outline. Select up to 50 extracted items, timing, cursor count, and colors, then preview and export or import a JSON configuration. It never fetches a URL, runs imported scripts, or retains the source layout, styling, images, or links. Do not open a downloaded configuration from an untrusted source without review.

## MP4 export

The optional exporter records a trusted local HTML page. It requires Playwright with a Chromium browser and FFmpeg with `libx264` on the same machine. Install Playwright in the same project as the package, for example:

```bash
npm install github:ruvnet/mouse-swarm playwright
npx playwright install chromium
```

Then export an HTML file and its local assets:

```bash
npx mouse-swarm-video --input examples/demo.html --output reveal.mp4 --preset portrait --duration 10 --fps 24
```

Run the command from a checkout containing `examples/demo.html`, or replace the input with the path to your own page. Presets are `portrait` (1080 by 1320, 9:11), `square` (1080 by 1080), and `vertical` (1080 by 1920). Use `--chromium /path/to/chromium` to select an existing browser. Output is H.264 MP4 with no audio; existing files are not overwritten. A failed export can leave a partial output file. Capture uses real time screenshots, so a busy machine can drop behind the intended schedule. Check the resulting file before sharing.

Only use trusted HTML. The exporter blocks external network requests and serves files from the HTML directory, but this is not a security sandbox. It does not record a remote Ruflo session.

To render an existing observation recording as a portrait video, run:

```bash
npx mouse-swarm-activity-video --input mouse-swarm-observations.json --output observations.mp4 --preset portrait --duration 10 --fps 24
```

The command validates and minimizes the recording, creates a temporary private replay page, and removes it after capture. It scales the observation intervals to fit the clip, so playback time is not the original elapsed time. Agent IDs, source labels, and observation timestamps appear in the video. The source labels are supplied by the recording and are not cryptographic proof. Review the MP4 before sharing; it may contain sensitive identifiers.

See the [Playwright guide](playwright.md) for browser checks and configurable capture settings, the [React example](../examples/react/SwarmReveal.jsx), the [Cloudflare deployment guide](cloudflare.md), and the [README](../README.md) for additional integrations.
