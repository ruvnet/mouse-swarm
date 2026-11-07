# Release and validation

The repository can be installed from GitHub. The first public npm release of `@ruvector/mouse-swarm` requires an authenticated npm identity with permission to publish under `@ruvector`.

## Validate a release candidate

From a clean checkout of the intended commit:

```bash
npm test
npm pack --dry-run
npm install --no-save playwright@1.65.0
npx playwright install chromium firefox
node examples/playwright-check.mjs
SWARM_BROWSER=firefox node examples/playwright-check.mjs
node examples/capture-check.mjs
```

The GitHub workflow runs Node 20 and 22 tests plus Chromium and Firefox playback and capture checks. CI results belong to the specific commit tested; the existence of the workflow alone does not mean a run passed.

## Publish

Authenticate with an appropriately authorized npm identity and check the current package version and registry status before publishing:

```bash
npm whoami
npm view @ruvector/mouse-swarm version
npm pack --dry-run
npm publish --access public
```

An absent package may make `npm view` return 404 before the first release. Publishing can require npm two factor authentication or a suitably permitted token. Do not put tokens in the repository, command output, documentation, or CI logs. Once published, verify the registry version and test installation in a fresh directory. Update installation instructions only after the published package is confirmed.
