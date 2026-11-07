# Activity, MetaHarness, studio, and video

## Record Ruflo observations

Start the local observer from the intended Ruflo project as described in the [Ruflo guide](ruflo-user-guide.md). Choose **Start recording** before the activity you want to observe. Successful snapshots create a bounded in-memory timeline of initial agents and subsequent observed changes. Choose **Stop recording**, then **Replay** or **Download JSON**. Pause and resume replay with the playback control. Closing the page discards an unsaved recording.

Each entry has an observation timestamp, a sequence number, and source provenance. The snapshot mode reports what changed between polls. It cannot establish the exact transition time or capture changes that occurred and reverted between polls. It does not prove an agent executed work. The recorder excludes task titles, prompts, labels, and coordinates, but agent IDs and source references are still included. Treat exported recordings as potentially sensitive.

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
// Later: adapter.dispose(); recorder.dispose();
```

This adapter does not discover sessions, subscribe to a native feed, execute agents, or authenticate a source. It requires monotonically increasing indices within each branch. Free-form payloads can contain private data; only map the fields your application is authorized to retain. The adapter follows the [MetaHarness session envelope](https://github.com/ruvnet/metaharness/blob/574ce3b881e902d23472a541f9f9e2fdccfa63db/packages/kernel-js/src/session.ts).

When combining sources, namespace agent IDs in the host mapper so identical IDs from separate sources do not merge into one replayed agent. Source references are labels supplied by the host, not cryptographic proof.

## Studio

Serve the repository over HTTP and open `examples/studio.html`. The studio configures a bundled sample page: choose elements, timing, cursor count, and colors, then preview and export or import a JSON configuration. It does not fetch or decompose arbitrary websites. Do not open a downloaded configuration from an untrusted source without review.

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

Only use trusted HTML. The exporter blocks external network requests and serves files from the HTML directory, but this is not a security sandbox. It does not record a remote Ruflo session or automatically turn a JSON timeline into a video.

See the [React example](../examples/react/SwarmReveal.jsx), the [Cloudflare deployment guide](cloudflare.md), and the [README](../README.md) for additional integrations.
