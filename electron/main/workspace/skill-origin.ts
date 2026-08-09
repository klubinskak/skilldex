/**
 * Skill provenance resolvers — turn a source-specific manifest into a browsable
 * `SkillOrigin` (repo + deep link to the skill's folder). One resolver per skill
 * source kind, sharing a common URL normalizer:
 *
 *  - Personal → `~/.agents/.skill-lock.json` entry (`personalOrigin`)
 *  - Plugin   → `marketplace.json` `plugins[].source` (`pluginOrigin`)
 *  - Project  → the enclosing clone's `.git/config` + `HEAD` (`projectOrigin`)
 *
 * Every function here is pure: it takes already-read data and returns an origin
 * or null. The filesystem reads and per-scan memoization live in the caller
 * (`filesystem-source.ts`), so these stay trivially unit-testable.
 */

import path from 'node:path'
import type { OriginHost, SkillOrigin } from './types'

export type RemoteInfo = {
  host: OriginHost
  label: string
  repoUrl: string
}

/** A single skill's entry in `~/.agents/.skill-lock.json`. */
export type SkillLockEntry = {
  source?: string
  sourceType?: string
  sourceUrl?: string
  skillPath?: string
}

/**
 * A plugin's `source` in a marketplace's `marketplace.json`. Either an object
 * pointing at an external repo (`url` / `git-subdir` / `github`), or a bare
 * string path (e.g. `./plugins/foo`) meaning the plugin lives inside the
 * marketplace's own repo.
 */
export type PluginSource =
  | string
  | {
      source?: string
      url?: string
      repo?: string
      path?: string
      ref?: string
    }

const KNOWN_HOSTS: Record<string, OriginHost> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'bitbucket.org': 'bitbucket',
}

/** Normalize any git remote (scp, ssh, https, with creds/port/.git) to a browsable repo. */
export function parseRemoteUrl(remote: string): RemoteInfo | null {
  const trimmed = remote.trim()
  if (!trimmed) return null

  let host: string
  let repoPath: string

  if (/:\/\//.test(trimmed)) {
    // scheme://[user[:pass]@]host[:port]/path
    let rest = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^[^@/]+@/, '')
    const slash = rest.indexOf('/')
    if (slash < 0) return null
    host = rest.slice(0, slash).replace(/:\d+$/, '')
    repoPath = rest.slice(slash + 1)
  } else {
    // scp-style: [user@]host:path (the `://` check above already excluded URLs)
    const match = /^(?:[^@/]+@)?([^/:]+):(.+)$/.exec(trimmed)
    if (!match) return null
    host = match[1]
    repoPath = match[2]
  }

  repoPath = repoPath
    .replace(/\.git$/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (!repoPath || !host) return null

  const lowerHost = host.toLowerCase()
  return {
    host: KNOWN_HOSTS[lowerHost] ?? 'other',
    label: repoPath,
    repoUrl: `https://${lowerHost}/${repoPath}`,
  }
}

/** Build a deep link to `subPath` within a repo at `ref` (or the repo root when empty). */
export function buildWebUrl(repo: RemoteInfo, subPath: string, ref = 'HEAD'): string {
  const clean = subPath
    .replace(/\/?SKILL\.md$/i, '')
    .replace(/^\.?\/+/, '')
    .replace(/\/+$/, '')
  if (!clean || clean === '.') return repo.repoUrl
  const segment = repo.host === 'bitbucket' ? 'src' : 'tree'
  return `${repo.repoUrl}/${segment}/${ref}/${clean}`
}

/** Resolve a git branch/commit from a `.git/HEAD` body; `HEAD` if unknown. */
export function refFromHead(head: string | null): string {
  if (!head) return 'HEAD'
  const trimmed = head.trim()
  const branch = /^ref:\s*refs\/heads\/(.+)$/.exec(trimmed)
  if (branch) return branch[1]
  if (/^[0-9a-f]{7,40}$/i.test(trimmed)) return trimmed
  return 'HEAD'
}

export function personalOrigin(entry: SkillLockEntry | undefined): SkillOrigin | null {
  if (!entry?.sourceUrl) return null
  const info = parseRemoteUrl(entry.sourceUrl)
  if (!info) return null
  const subPath = entry.skillPath ? path.posix.dirname(entry.skillPath) : ''
  return {
    host: info.host,
    label: entry.source || info.label,
    repoUrl: info.repoUrl,
    webUrl: buildWebUrl(info, subPath),
  }
}

/**
 * Resolve a plugin skill's origin. `marketplaceRepo` is the marketplace's own
 * repo (from `known_marketplaces.json`) — used when a plugin's source is a bare
 * path string, meaning it ships inside the marketplace repo itself.
 */
export function pluginOrigin(
  source: PluginSource | undefined,
  skillName: string,
  marketplaceRepo?: RemoteInfo | null,
): SkillOrigin | null {
  let info: RemoteInfo | null = null
  let pluginPath = ''
  let ref = 'HEAD'

  if (typeof source === 'string') {
    if (!marketplaceRepo) return null
    info = marketplaceRepo
    pluginPath = source
  } else if (source?.url) {
    info = parseRemoteUrl(source.url)
    pluginPath = source.path ?? ''
    ref = source.ref || 'HEAD'
  } else if (source?.source === 'github' && source.repo) {
    info = parseRemoteUrl(`https://github.com/${source.repo}.git`)
    pluginPath = source.path ?? ''
    ref = source.ref || 'HEAD'
  }
  if (!info) return null

  const subPath = path.posix.join(pluginPath.replace(/^\.?\/+/, ''), 'skills', skillName)
  return {
    host: info.host,
    label: info.label,
    repoUrl: info.repoUrl,
    webUrl: buildWebUrl(info, subPath, ref),
  }
}

export function projectOrigin(input: {
  gitConfig: string
  head: string | null
  skillRelPath: string
}): SkillOrigin | null {
  const remote = remoteFromGitConfig(input.gitConfig)
  if (!remote) return null
  const info = parseRemoteUrl(remote)
  if (!info) return null
  return {
    host: info.host,
    label: info.label,
    repoUrl: info.repoUrl,
    webUrl: buildWebUrl(info, input.skillRelPath, refFromHead(input.head)),
  }
}

/** Extract the `origin` remote's url from a `.git/config` body (any remote as a fallback). */
function remoteFromGitConfig(config: string): string | null {
  const origin = /\[remote "origin"\][^[]*?url\s*=\s*([^\n]+)/.exec(config)
  if (origin) return origin[1].trim()
  const any = /\[remote "[^"]+"\][^[]*?url\s*=\s*([^\n]+)/.exec(config)
  return any ? any[1].trim() : null
}
