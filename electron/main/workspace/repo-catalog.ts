/**
 * Remote skill-repo catalog — the app's only network code.
 *
 * A user adds a GitHub repo; we resolve its default branch, list its full tree
 * via the GitHub API (two API calls per scan, so unauthenticated rate limits
 * are a non-issue), and treat every directory containing a `SKILL.md` as an
 * installable skill. SKILL.md frontmatter and file contents are fetched from
 * raw.githubusercontent.com, which is not API-rate-limited.
 *
 * "Awesome list" repos (no SKILL.md anywhere, README full of GitHub links)
 * yield the linked repos instead, so the UI can offer those as additions.
 *
 * `fetch` is injected so tests drive the whole module against a fake network.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { parseFrontmatter } from './frontmatter'
import type { RepoCatalog, RepoSkill } from './types'

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}>

export type RepoRef = {
  /** Normalized `owner/repo`. */
  slug: string
  /** Branch requested via a `/tree/<branch>` URL; default branch when absent. */
  ref?: string
}

/** A scan result: the serializable catalog plus the per-skill file lists kept main-side. */
export type RepoScan = {
  catalog: RepoCatalog
  /** RepoSkill id → file paths relative to the skill directory. */
  filesBySkill: Map<string, string[]>
}

const API = 'https://api.github.com'
const API_HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'skilldex' }
const RAW = 'https://raw.githubusercontent.com'
const MAX_SKILLS = 300
const MAX_LINKED_REPOS = 100
const FETCH_POOL = 8

// GitHub path segments that can appear as `github.com/<segment>/...` in a README
// but are never a repo owner.
const NON_OWNER_SEGMENTS = new Set([
  'about', 'apps', 'blog', 'collections', 'contact', 'customer-stories', 'enterprise',
  'features', 'issues', 'join', 'login', 'marketplace', 'new', 'notifications', 'orgs',
  'pricing', 'pulls', 'readme', 'search', 'security', 'settings', 'site', 'sponsors',
  'team', 'topics', 'trending',
])

/**
 * Parse user input naming a GitHub repo. Accepts `owner/repo`,
 * `github.com/owner/repo`, `https://github.com/owner/repo(.git)`,
 * `git@github.com:owner/repo.git`, and URLs with a `/tree/<branch>` suffix.
 * Returns null for anything else (non-GitHub hosts included).
 */
export function parseRepoInput(input: string): RepoRef | null {
  let rest = input.trim()
  if (!rest) return null

  const scp = /^git@github\.com:(.+)$/i.exec(rest)
  if (scp) {
    rest = scp[1]
  } else {
    const hadScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(rest)
    rest = rest.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    const firstSegment = rest.split('/')[0]
    if (hadScheme || firstSegment.includes('.')) {
      const host = firstSegment.replace(/^www\./i, '').replace(/:\d+$/, '').toLowerCase()
      if (host !== 'github.com') return null
      rest = rest.slice(firstSegment.length).replace(/^\/+/, '')
    }
  }

  const segments = rest.split(/[?#]/)[0].split('/').filter(Boolean)
  if (segments.length < 2) return null
  const owner = segments[0]
  const repo = segments[1].replace(/\.git$/i, '')
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null
  if (NON_OWNER_SEGMENTS.has(owner.toLowerCase())) return null

  const ref = segments[2] === 'tree' && segments[3] ? decodeURIComponent(segments[3]) : undefined
  return { slug: `${owner}/${repo}`, ref }
}

/** Scan a GitHub repo for skills (directories containing a SKILL.md). */
export async function fetchRepoCatalog(repo: RepoRef, fetchImpl: FetchLike): Promise<RepoScan> {
  const { slug } = repo
  const ref = repo.ref ?? (await fetchDefaultBranch(slug, fetchImpl))
  const tree = await fetchTree(slug, ref, fetchImpl)

  const blobs = tree.entries.filter((entry) => entry.type === 'blob')
  const skillDirs = blobs
    .filter((entry) => path.posix.basename(entry.path) === 'SKILL.md')
    .map((entry) => path.posix.dirname(entry.path).replace(/^\.$/, ''))
    .sort((a, b) => a.localeCompare(b))

  const capped = skillDirs.slice(0, MAX_SKILLS)
  const filesBySkill = new Map<string, string[]>()
  const skills: RepoSkill[] = await mapPool(capped, FETCH_POOL, async (dir) => {
    const id = `${slug}:${dir}`
    const prefix = dir ? `${dir}/` : ''
    const files = blobs
      .filter((entry) => entry.path.startsWith(prefix))
      .map((entry) => entry.path.slice(prefix.length))
    filesBySkill.set(id, files)

    const markdown = await fetchRaw(slug, ref, dir ? `${dir}/SKILL.md` : 'SKILL.md', fetchImpl)
      .then((buffer) => buffer.toString('utf8'))
      .catch(() => '')
    const meta = parseFrontmatter(markdown)
    return {
      id,
      name: meta.name || path.posix.basename(dir) || slug.split('/')[1],
      description: meta.description ?? '',
      path: dir,
      fileCount: files.length,
      webUrl: dir ? `https://github.com/${slug}/tree/${ref}/${dir}` : `https://github.com/${slug}`,
    }
  })

  // No skills at all? This may be an index/awesome-list repo — surface the
  // GitHub repos its README links to so the user can add those instead.
  let linkedRepos: string[] = []
  if (skills.length === 0) {
    linkedRepos = await fetchLinkedRepos(slug, ref, blobs, fetchImpl)
  }

  return {
    catalog: {
      slug,
      url: `https://github.com/${slug}`,
      ref,
      skills,
      linkedRepos,
      truncated: tree.truncated || skillDirs.length > MAX_SKILLS,
    },
    filesBySkill,
  }
}

/**
 * Download one skill folder into `dest` (which must not exist yet). Fetches
 * every file from raw.githubusercontent.com; on any failure the partial
 * download is removed so a broken install never looks like a skill.
 */
export async function downloadRepoSkill(opts: {
  slug: string
  ref: string
  /** Skill directory within the repo ('' for a root-level skill). */
  dir: string
  /** File paths relative to the skill directory. */
  files: string[]
  /** Absolute destination directory for the skill. */
  dest: string
  fetchImpl: FetchLike
}): Promise<void> {
  const { slug, ref, dir, files, dest, fetchImpl } = opts
  await assertMissing(dest, `A skill named "${path.basename(dest)}" already exists.`)
  await fs.mkdir(dest, { recursive: true })
  try {
    await mapPool(files, FETCH_POOL, async (file) => {
      const repoPath = dir ? `${dir}/${file}` : file
      const buffer = await fetchRaw(slug, ref, repoPath, fetchImpl)
      const target = path.join(dest, ...file.split('/'))
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, buffer)
    })
  } catch (cause) {
    await fs.rm(dest, { recursive: true, force: true }).catch(() => {})
    throw cause
  }
}

type TreeEntry = { path: string; type: string }

async function fetchDefaultBranch(slug: string, fetchImpl: FetchLike): Promise<string> {
  const data = (await apiGet(`${API}/repos/${slug}`, slug, fetchImpl)) as { default_branch?: string }
  return data.default_branch || 'main'
}

async function fetchTree(
  slug: string,
  ref: string,
  fetchImpl: FetchLike,
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const data = (await apiGet(
    `${API}/repos/${slug}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    slug,
    fetchImpl,
  )) as { tree?: TreeEntry[]; truncated?: boolean }
  return { entries: data.tree ?? [], truncated: data.truncated ?? false }
}

async function apiGet(url: string, slug: string, fetchImpl: FetchLike): Promise<unknown> {
  let response: Awaited<ReturnType<FetchLike>>
  try {
    response = await fetchImpl(url, { headers: API_HEADERS })
  } catch {
    throw new Error(`Could not reach GitHub. Check your network connection.`)
  }
  if (response.status === 404) throw new Error(`Repository not found on GitHub: ${slug}`)
  if (response.status === 403 || response.status === 429)
    throw new Error('GitHub API rate limit reached. Try again in a little while.')
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${slug}.`)
  return response.json()
}

async function fetchRaw(slug: string, ref: string, repoPath: string, fetchImpl: FetchLike): Promise<Buffer> {
  const encoded = repoPath.split('/').map(encodeURIComponent).join('/')
  const url = `${RAW}/${slug}/${encodeURIComponent(ref)}/${encoded}`
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'skilldex' } })
  if (!response.ok) throw new Error(`Failed to download ${repoPath} (${response.status}).`)
  return Buffer.from(await response.arrayBuffer())
}

/** Extract `owner/repo` slugs linked from a repo's root README, excluding itself. */
async function fetchLinkedRepos(
  slug: string,
  ref: string,
  blobs: TreeEntry[],
  fetchImpl: FetchLike,
): Promise<string[]> {
  const readme = blobs.find(
    (entry) => !entry.path.includes('/') && /^readme(\.(md|markdown|txt))?$/i.test(entry.path),
  )
  if (!readme) return []

  const markdown = await fetchRaw(slug, ref, readme.path, fetchImpl)
    .then((buffer) => buffer.toString('utf8'))
    .catch(() => '')

  const seen = new Set<string>([slug.toLowerCase()])
  const linked: string[] = []
  const pattern = /github\.com\/([A-Za-z0-9_-][A-Za-z0-9_.-]*)\/([A-Za-z0-9_-][A-Za-z0-9_.-]*)/g
  for (const match of markdown.matchAll(pattern)) {
    const owner = match[1]
    const repo = match[2].replace(/\.git$/i, '').replace(/[.,]+$/, '')
    if (NON_OWNER_SEGMENTS.has(owner.toLowerCase())) continue
    const candidate = `${owner}/${repo}`
    if (seen.has(candidate.toLowerCase())) continue
    seen.add(candidate.toLowerCase())
    linked.push(candidate)
    if (linked.length >= MAX_LINKED_REPOS) break
  }
  return linked
}

/** Run `fn` over `items` with at most `limit` in flight; results keep item order. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

async function assertMissing(target: string, message: string): Promise<void> {
  try {
    await fs.access(target)
  } catch {
    return
  }
  throw new Error(message)
}
