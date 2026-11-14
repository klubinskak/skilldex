/**
 * On-disk copy of each skill repo's last good scan.
 *
 * GitHub allows 60 unauthenticated API calls an hour per machine, and every
 * scan costs two. Without a cache, a user with eight repos uses 16 calls per
 * launch, so a few launches in an hour turn every repo into an error. With it:
 *
 * - a repo scanned recently is served from disk at launch (no API calls), and
 * - when a scan fails (rate limit, offline), the last good scan is shown
 *   instead of an empty error card.
 *
 * Only public GitHub data is stored (catalog + file lists). The file path is
 * injected so the app wires it to `app.getPath('userData')` and tests use a
 * temp file. A missing or corrupt file just means an empty cache.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { RepoScan } from './repo-catalog'
import type { RepoCatalog } from './types'

export type CachedRepoScan = {
  scan: RepoScan
  /** When this scan was fetched from GitHub (epoch ms). */
  fetchedAt: number
}

export type RepoCache = {
  get(slug: string): Promise<CachedRepoScan | null>
  set(slug: string, scan: RepoScan, fetchedAt: number): Promise<void>
  delete(slug: string): Promise<void>
}

type StoredEntry = {
  fetchedAt: number
  catalog: RepoCatalog
  filesBySkill: Record<string, string[]>
}

type StoredFile = { version: 1; repos: Record<string, StoredEntry> }

export function createRepoCache(filePath: string): RepoCache {
  // Loaded once, then kept in memory; every change is written straight back.
  let loaded: Promise<Record<string, StoredEntry>> | null = null
  // Writes are chained so two quick changes can never interleave on disk.
  let writing: Promise<void> = Promise.resolve()

  function load(): Promise<Record<string, StoredEntry>> {
    loaded ??= fs
      .readFile(filePath, 'utf8')
      .then((raw) => normalize(JSON.parse(raw)))
      .catch(() => ({}))
    return loaded
  }

  async function persist(repos: Record<string, StoredEntry>): Promise<void> {
    const body: StoredFile = { version: 1, repos }
    writing = writing
      .then(async () => {
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        // Temp file + rename, so a crash mid-write never leaves a truncated cache.
        const tmp = `${filePath}.${process.pid}.tmp`
        await fs.writeFile(tmp, JSON.stringify(body), 'utf8')
        await fs.rename(tmp, filePath)
      })
      // A cache that can't be written is only a missed optimisation.
      .catch(() => {})
    return writing
  }

  return {
    async get(slug) {
      const entry = (await load())[slug]
      if (!entry) return null
      return {
        fetchedAt: entry.fetchedAt,
        scan: { catalog: entry.catalog, filesBySkill: new Map(Object.entries(entry.filesBySkill)) },
      }
    },
    async set(slug, scan, fetchedAt) {
      const repos = await load()
      // Never store a transient error or stale note as if it were the scan itself.
      const { error: _error, refreshError: _refreshError, ...catalog } = scan.catalog
      repos[slug] = { fetchedAt, catalog, filesBySkill: Object.fromEntries(scan.filesBySkill) }
      await persist(repos)
    },
    async delete(slug) {
      const repos = await load()
      if (!(slug in repos)) return
      delete repos[slug]
      await persist(repos)
    },
  }
}

/** Keep only well-formed entries, so a hand-edited or older file can't crash a scan. */
function normalize(value: unknown): Record<string, StoredEntry> {
  const repos = (value as Partial<StoredFile> | null)?.repos
  if (!repos || typeof repos !== 'object') return {}
  const result: Record<string, StoredEntry> = {}
  for (const [slug, entry] of Object.entries(repos as Record<string, Partial<StoredEntry>>)) {
    if (
      entry &&
      typeof entry.fetchedAt === 'number' &&
      entry.catalog &&
      Array.isArray(entry.catalog.skills) &&
      entry.filesBySkill &&
      typeof entry.filesBySkill === 'object'
    ) {
      result[slug] = entry as StoredEntry
    }
  }
  return result
}
