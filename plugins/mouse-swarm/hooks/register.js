/** Optional in-process Claude Code mod. No files, network, prompts or tool arguments are read. */
let spawnEvents = 0;

/** Mod hooks run only in compatible Claude Code environments. */
export function register(on) {
  on('session.start', async ($, event, next) => {
    try {
      await $.command.register({name: 'mouse-swarm-mod-status', description: 'Show observed Mouse Swarm mod status'});
    } catch { /* The command API may not be available in this host. */ }
    return next(event);
  });

  on('agent.spawn', async ($, event, next) => {
    const result = await next(event);
    if (result && result.deny === undefined && typeof result.agentId === 'string' && result.agentId) {
      spawnEvents = Math.min(Number.MAX_SAFE_INTEGER, spawnEvents + 1);
      try { await $.ruflo.segment({id: 'mouse-swarm', text: `Swarm: ${spawnEvents} observed spawns`}); }
      catch { /* Ruflo mods are optional; never change the spawn result. */ }
    }
    return result;
  });

  on('command.run', {command: 'mouse-swarm-mod-status'}, async ($) => {
    let status = 'Ruflo mod unavailable or not active';
    try {
      const snapshot = await $.ruflo.snapshot();
      if (snapshot && typeof snapshot === 'object') {
        const policies = new Set(['none', 'observe', 'enforce', 'unreadable']);
        const policy = policies.has(snapshot.policy) ? snapshot.policy : 'unknown';
        const routes = Number.isSafeInteger(snapshot.routed) && snapshot.routed >= 0 ? snapshot.routed : 0;
        status = `Ruflo mod available; policy: ${policy}; routes: ${routes}`;
      }
    } catch { /* Missing or unsupported Ruflo mod is normal. */ }
    return {text: `Mouse Swarm mod: ${spawnEvents} observed agent spawns in this process. ${status}. Spawn events do not prove task execution or cursor positions.`};
  });
}
