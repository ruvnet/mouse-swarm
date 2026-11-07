---
description: Observe local Ruflo agent registrations and status
argument-hint: "[project directory]"
---

Help the user observe the intended local Ruflo project: $ARGUMENTS. First verify the directory and installed Ruflo CLI, then use the opt-in loopback observer documented in `${CLAUDE_PLUGIN_ROOT}/docs/ruflo-user-guide.md`. Agent registrations and status snapshots do not prove execution; the CLI does not provide cursor positions. Never expose the local server publicly or place prompts or credentials in the page. Do not start agents or execute tasks unless separately requested.

If installed and loaded, the optional Ruflo mods plugin may provide its own routing and policy status. Its availability is not required for this command. Do not install or modify it automatically.
