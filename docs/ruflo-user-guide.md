# Ruflo observation user guide

Mouse Swarm can show reported Ruflo agent registrations and statuses in a browser on the same computer as the Ruflo CLI. This is a read only view of the local CLI, separate from the animated landing page reveal.

The view does not start or stop agents, execute tasks, prove that work was performed, or access cursor positions. Its browser polling is a status snapshot, not a stream of task events. The animated cursors in the reveal are illustrative.

## Before you start

You need Node.js 18 or later, npm, the Ruflo CLI on your `PATH`, and a local Ruflo project. Open a terminal in the project you want to observe. The CLI and browser must run on the same machine for this local example.

Check that the CLI works in that directory:

```bash
ruflo --version
ruflo agent list --format json
```

The list should be a JSON object containing an `agents` array. An empty array means the CLI reported no registrations in that project. It does not by itself mean the connection is broken.

## Start the view

From the same project directory:

```bash
npx --yes --package=github:ruvnet/mouse-swarm mouse-swarm observe --port 4173
```

Open the printed URL, normally `http://127.0.0.1:4173/`, in a browser on that machine. The page shows the source state and the reported agent ID, role, and status. Polling happens approximately every 2.5 seconds. Press Ctrl+C in the terminal to stop the server.

To use another port, change the value after `--port`. If the machine is remote, the address refers to the remote machine itself. Use a browser on that machine; the example does not provide remote access.

The server is bound to loopback and is designed for local use. It is not an authentication service: other processes on the same machine may be able to access it. Do not publish it to the internet or expose it through a proxy without a separately designed authentication and authorization layer.

## Verify with a test registration

Use an isolated project directory if you want to test without changing an existing swarm:

```bash
mkdir -p /tmp/mouse-swarm-ruflo-test
cd /tmp/mouse-swarm-ruflo-test
ruflo agent spawn --type coder --name mouse-swarm-test --timeout 30
ruflo agent list --format json
```

Note the ID printed by Ruflo. Start the view from this directory, then confirm that the ID appears with its role and reported status. A registration may be idle; registration alone is not evidence of execution. No task needs to be submitted for this check.

Stop the view with Ctrl+C. Then stop only the test agent using its actual ID:

```bash
ruflo agent stop YOUR_TEST_AGENT_ID
ruflo agent list --format json
```

The isolated list should no longer contain that test agent. Leave other agents untouched.

## What the bridge sends

The local server runs `ruflo agent list --format json` with the directory from which you launched it. It projects each entry to an ID, label, role, and reported status. The label is currently the ID. Unknown status values become `unknown`. It omits the agent's name, task descriptions, prompts, and credentials.

The bridge accepts up to 64 agents by default. It fails the snapshot if the CLI output is invalid, duplicated, oversized, or exceeds that limit. It does not silently show a partial list. The CLI call has a five second timeout. When a poll fails after a successful one, the previous list is marked stale; the server does not return it as fresh.

For a direct connection check while the server is running:

```bash
curl http://127.0.0.1:4173/api/ruflo/agents
```

The response has an `events` array of normalized `agent.upsert` records. These are Mouse Swarm's projection, not a native Ruflo event stream. If you chose another port, use it in the URL.

## Use it in your own application

Install the package from GitHub. The npm registry release is pending.

```bash
npm install github:ruvnet/mouse-swarm
```

Use `@ruvector/mouse-swarm/ruflo` for the in-memory adapter and `@ruvector/mouse-swarm/ruflo-view` for the browser view. A custom source must perform its own authentication, authorization, normalization, and polling or streaming. The modules do not establish a Ruflo connection for you.

```js
import { createRufloSwarmAdapter } from '@ruvector/mouse-swarm/ruflo';
import { createRufloSwarmView } from '@ruvector/mouse-swarm/ruflo-view';

const adapter = createRufloSwarmAdapter({ maxAgents: 64 });
const view = createRufloSwarmView({
  adapter,
  container: document.querySelector('#swarm')
});

// Illustrative data only. Replace with a complete, verified source snapshot.
const events = [{ type: 'agent.upsert', id: 'example-1', role: 'coder', status: 'idle' }];
adapter.replaceAgents(events);
// Set this only after your own source actually succeeds:
// view.setSourceState('connected');

// On a later source failure, use view.setSourceState('stale') or 'error'.
// On teardown: view.destroy(); adapter.dispose();
```

`replaceAgents(events)` validates and atomically replaces a complete snapshot. `ingest(event)` accepts individual normalized `agent.upsert`, `agent.remove`, and `task.update` events. Task titles are hidden by default; the built in CLI bridge does not fetch them. Do not send private task details or credentials to a public page.

Markers require coordinates supplied by a trusted source as `position: { x, y }`, with each value normalized from 0 to 1. Ruflo's CLI list does not provide those coordinates. Do not fabricate coordinates and present them as actual agent movement. The view removes markers when the source is stale, disconnected, or in error.

For sources with per-agent revisions, equal revisions in snapshots retain the previous data and older revisions are rejected. Removal history is bounded to twice the adapter's `maxAgents`; the source must also prevent very late events after that history is evicted.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Empty list | Run `ruflo agent list --format json` in the same directory. Confirm the intended project has registered agents. |
| Source unavailable | Check that `ruflo` is on `PATH`, outputs valid JSON, and completes within five seconds. Start the server from the project directory. |
| Previous results marked stale | The last poll failed. Check the CLI, then wait for a successful poll. The prior list is not current evidence. |
| Snapshot rejected | Check for duplicate IDs, invalid IDs, malformed JSON, or more than 64 agents. The bridge intentionally does not return partial results. |
| Port already in use | Supply an unused port with `--port` and open the new printed URL. |
| Page unavailable on another device | The server listens on the local machine only. Open the page on the machine running it. |
| No moving cursors | The CLI does not report positions. The local status view shows a list; the separate reveal uses simulated cursors. |
| Skill or package install fails | Check Node.js and npm, network access, and your installed `skills` CLI requirements. The GitHub installation commands are in the [README](../README.md). |

See the [README](../README.md) for the reveal, playback controls, configuration, and skill installation.
