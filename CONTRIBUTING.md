# Contributing

Thanks for taking the time to help. This file covers how to build the plugin,
what the code review looks for, and how a release is cut.

## Getting started

The plugin targets Obsidian 1.13.0 and later, and builds on Node 18 — the same
version the release workflow runs.

```bash
npm install
npm run dev     # watch mode; writes main.js in place
npm run build   # type check + lint + emit main.js
```

To try a development build, symlink or copy `main.js`, `manifest.json` and
`styles.css` into `<vault>/.obsidian/plugins/open-taiwan-calendar/`, then
reload Obsidian.

## Before you open a pull request

`npm run build` must pass. It runs `tsc -noEmit`, then ESLint with
`eslint-plugin-obsidianmd`, then the production bundle. Both the type check and
the lint step are treated as blocking; warnings left in the bundle show up on
the plugin's scorecard in the community directory.

Beyond that:

- **No network access.** The plugin makes zero outbound requests, and the
  release workflow fails the build if `fetch(`, `XMLHttpRequest`, `WebSocket`,
  `requestUrl`, `sendBeacon` or `EventSource` appears in `main.js`. Holiday data
  ships with the plugin instead of being fetched.
- **Use the Obsidian API.** Build DOM with the `createEl` helpers rather than
  `document.createElement`, and persist settings through the plugin data API
  rather than `localStorage`.
- **Keep user-facing strings in `src/i18n/`.** Add the key to both `en.ts` and
  `zh-TW.ts`; the interface follows the Obsidian display language.
- **Match the surrounding style.** Comments, commit messages and documentation
  are written in English.

## Holiday data

`src/holiday/rocHoliday.ts` computes the fixed-date holidays, the three major
lunar festivals and Tomb Sweeping Day algorithmically, so they are correct for
any year. Only the substitute-day adjustments — the make-up workdays and
substitute holidays announced each year by the Directorate-General of Personnel
Administration — are stored as data, in `src/holiday/rocHolidayData.ts`.

When a new year is announced, add its entries there and cite the announcement in
the pull request. Do not add an entry for a year that has no official
announcement yet.

## Reporting a bug

Open an issue with the Obsidian version, the operating system, the plugin
version, and the steps that reproduce the problem. For a wrong date, say which
date and what you expected instead — a screenshot of the calendar cell helps.

## Releasing

Releases are cut by pushing a tag; the workflow in
`.github/workflows/release.yml` does the rest.

1. Bump `version` in `manifest.json` and `package.json`.
2. Add the new version to `versions.json`, mapped to its `minAppVersion`.
3. Commit, then tag with the bare version number (`1.2.0`, no `v` prefix) and
   push the tag.

The workflow builds, verifies the bundle makes no network calls, attests build
provenance for the three release assets, and creates the release with generated
notes. Only `main.js`, `manifest.json` and `styles.css` are published — do not
attach a zip archive, which the directory's review flags as an unsupported file.

## License

By contributing you agree that your work is licensed under the MIT License, the
same terms as the rest of the project.
