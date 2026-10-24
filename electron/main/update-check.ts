/**
 * "Is there a newer Skilldex?" for platforms where electron-updater cannot
 * install updates itself. On macOS that needs a signed app, which Skilldex is
 * not, so the app only tells the user and links to the download.
 *
 * Reads `latest-mac.yml`, the file electron-builder attaches to every release
 * and the Windows/Linux updater reads too. It is a plain release download, so
 * unlike GitHub's API it has no 60-requests-an-hour limit. Nothing about the
 * user is sent.
 */

const REPO = 'klubinskak/skilldex'
const RELEASES_PREFIX = `https://github.com/${REPO}/releases/`
export const LATEST_MAC_YML = `${RELEASES_PREFIX}latest/download/latest-mac.yml`

export type UpdateInfo = {
  /** Latest published version, without a leading `v`. */
  version: string
  /** Release page with the notes. */
  releaseUrl: string
  /** Direct `.dmg` download, or the release page when there is none. */
  downloadUrl: string
}

/** Only links into this repo's releases may be opened from the update card. */
export function isReleaseUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(RELEASES_PREFIX)
}

export function isNewer(candidate: string, current: string): boolean {
  const parts = (version: string) => version.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0)
  const a = parts(candidate)
  const b = parts(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

/** Read `latest-mac.yml` (published releases only; drafts never become "latest"). */
export function parseLatestMacYml(text: unknown): UpdateInfo | null {
  if (typeof text !== 'string') return null
  const field = (name: string) => new RegExp(`^${name}:\\s*['"]?([^'"\\s]+)`, 'm').exec(text)?.[1]
  const version = field('version')?.replace(/^v/, '')
  if (!version || !/^\d+(\.\d+)*$/.test(version)) return null
  const releaseUrl = `${RELEASES_PREFIX}tag/v${version}`
  const file = field('path')
  const downloadUrl =
    file && /^[\w.-]+\.dmg$/.test(file) ? `${RELEASES_PREFIX}download/v${version}/${file}` : releaseUrl
  return { version, releaseUrl, downloadUrl }
}

export async function checkForUpdate({
  currentVersion,
  fetchLatest,
}: {
  currentVersion: string
  fetchLatest: () => Promise<unknown>
}): Promise<UpdateInfo | null> {
  try {
    const latest = parseLatestMacYml(await fetchLatest())
    return latest && isNewer(latest.version, currentVersion) ? latest : null
  } catch {
    // Offline, rate-limited or GitHub down: no card, try again next launch.
    return null
  }
}

export async function fetchLatestMacYml(): Promise<string> {
  const response = await fetch(LATEST_MAC_YML, {
    headers: { 'User-Agent': 'Skilldex' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  return response.text()
}
