import { describe, expect, it } from 'vitest'
import { checkForUpdate, isNewer, isReleaseUrl, parseLatestMacYml } from '../update-check'

const RELEASES = 'https://github.com/klubinskak/skilldex/releases'

// What electron-builder publishes as `latest-mac.yml`.
const yml = `version: 0.3.0
files:
  - url: skilldex.dmg
    sha512: abc==
    size: 222503673
path: skilldex.dmg
sha512: abc==
releaseDate: '2026-10-24T05:29:00.912Z'
`

describe('isNewer', () => {
  it('compares each part as a number, not as text', () => {
    expect(isNewer('0.10.0', '0.9.0')).toBe(true)
    expect(isNewer('0.3.0', '0.2.9')).toBe(true)
    expect(isNewer('1.0.0', '0.99.99')).toBe(true)
  })

  it('is false for the same or an older version', () => {
    expect(isNewer('0.2.0', '0.2.0')).toBe(false)
    expect(isNewer('0.1.0', '0.2.0')).toBe(false)
  })

  it('ignores a leading v and treats missing parts as 0', () => {
    expect(isNewer('v0.3', '0.2.0')).toBe(true)
    expect(isNewer('0.2', 'v0.2.0')).toBe(false)
  })
})

describe('parseLatestMacYml', () => {
  it('reads the version, release page and .dmg download', () => {
    expect(parseLatestMacYml(yml)).toEqual({
      version: '0.3.0',
      releaseUrl: `${RELEASES}/tag/v0.3.0`,
      downloadUrl: `${RELEASES}/download/v0.3.0/skilldex.dmg`,
    })
  })

  it('accepts a quoted version', () => {
    expect(parseLatestMacYml("version: '0.3.1'\npath: skilldex.dmg\n")?.version).toBe('0.3.1')
  })

  it('falls back to the release page when the path is not a plain .dmg name', () => {
    expect(parseLatestMacYml('version: 0.3.0\npath: ../../evil.dmg\n')?.downloadUrl).toBe(`${RELEASES}/tag/v0.3.0`)
    expect(parseLatestMacYml('version: 0.3.0\n')?.downloadUrl).toBe(`${RELEASES}/tag/v0.3.0`)
  })

  it('returns null for junk', () => {
    expect(parseLatestMacYml(null)).toBeNull()
    expect(parseLatestMacYml('Not Found')).toBeNull()
    expect(parseLatestMacYml('version: latest/../x\n')).toBeNull()
  })
})

describe('isReleaseUrl', () => {
  it('only allows Skilldex release pages and downloads', () => {
    expect(isReleaseUrl(`${RELEASES}/tag/v0.3.0`)).toBe(true)
    expect(isReleaseUrl('https://github.com/klubinskak/skilldex-evil/releases/tag/x')).toBe(false)
    expect(isReleaseUrl('http://github.com/klubinskak/skilldex/releases/tag/x')).toBe(false)
    expect(isReleaseUrl('not a url')).toBe(false)
  })
})

describe('checkForUpdate', () => {
  it('returns the update when the latest release is newer', async () => {
    const update = await checkForUpdate({ currentVersion: '0.2.0', fetchLatest: async () => yml })
    expect(update?.version).toBe('0.3.0')
  })

  it('returns null when already on the latest version', async () => {
    expect(await checkForUpdate({ currentVersion: '0.3.0', fetchLatest: async () => yml })).toBeNull()
  })

  it('returns null instead of throwing when offline', async () => {
    const offline = async () => {
      throw new Error('getaddrinfo ENOTFOUND github.com')
    }
    expect(await checkForUpdate({ currentVersion: '0.2.0', fetchLatest: offline })).toBeNull()
  })
})
