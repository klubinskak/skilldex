# Release & distribution

## Goal

Let anyone download Skilldex from the marketing site (skilldex-web). The site's
"Download Skilldex" button already links to
`https://github.com/klubinskak/skilldex/releases/latest` — this plan produces
the releases that URL serves.

## How it works

A GitHub Actions workflow builds the desktop app on macOS, Windows, and Linux
and publishes the installers to a GitHub Release. The web button needs no
changes — once a release is published, `/releases/latest` serves the assets.

- **Trigger**: push a version tag `v*` (e.g. `v0.1.0`), or run the workflow
  manually from the Actions tab.
- **Build matrix**: `macos-latest` → `.dmg`, `windows-latest` → NSIS `.exe`,
  `ubuntu-latest` → `.AppImage`. A `.dmg` can only be built on macOS, an NSIS
  installer on Windows — hence the matrix.
- **Publish**: electron-builder (`--publish always`) creates the release and
  uploads each platform's artifact to it, using the workflow's `GITHUB_TOKEN`.

## Configuration (electron-builder, in package.json `build`)

- `publish`: GitHub provider (`klubinskak/skilldex`).
- `mac` → dmg (icon `build/icon.icns`), `win` → nsis, `linux` → AppImage
  (both icons `build/icon.png`).
- Icons committed under `build/` — they were previously untracked, so no CI
  build could have found them.
- Version bumped `0.0.0` → `0.1.0`.
- Scripts: `package` (local build, no publish) and `release` (build + publish).

## Cutting a release

1. Bump `version` in `package.json` (e.g. `0.1.0` → `0.2.0`).
2. Commit, then tag and push:
   ```
   git tag v0.2.0
   git push origin v0.2.0
   ```
3. The workflow builds all three platforms and uploads to a **draft** release.
4. Open the release on GitHub, check the assets, and click **Publish release**.
   The site's download button now serves it.

## Known limitations / follow-ups

- **macOS is unsigned/un-notarized.** Gatekeeper will warn ("unidentified
  developer"); users open via right-click → Open. Proper notarization needs a
  paid Apple Developer account and `CSC_LINK` / `APPLE_ID` secrets — a future
  step, not wired here.
- **Windows is unsigned** too (SmartScreen may warn). Same story: needs a code
  signing certificate.
- **Draft-by-default** is deliberate for now — nothing goes public without a
  human clicking Publish. Flip to a non-draft release later if you want fully
  hands-off publishing.
- **Optional web polish**: OS-detection to auto-offer the right installer, and
  show the current version — the button works without it.
