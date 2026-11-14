import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createConfigStore } from '../config'
import type { FetchLike, RepoScan } from '../repo-catalog'
import { createRepoCache } from '../repo-cache'
import { createSkillWorkspace, REPO_CACHE_MAX_AGE_MS } from '../skill-workspace'

const SLUG = 'acme/skills'
const API_REPO = `https://api.github.com/repos/${SLUG}`
const API_TREE = `${API_REPO}/git/trees/main?recursive=1`
const RAW = `https://raw.githubusercontent.com/${SLUG}/main`

const ROUTES: Record<string, unknown> = {
  [API_REPO]: { default_branch: 'main', stargazers_count: 42 },
  [API_TREE]: {
    truncated: false,
    tree: [
      { path: 'skills/tdd', type: 'tree' },
      { path: 'skills/tdd/SKILL.md', type: 'blob' },
    ],
  },
  [`${RAW}/skills/tdd/SKILL.md`]: '---\nname: tdd\ndescription: Test-driven development\n---\n',
}

/**
 * A fake GitHub. `rateLimited` makes every API call answer 403 like GitHub does
 * once the hourly limit is used up; raw file downloads keep working.
 */
function fakeGitHub() {
  const state = { rateLimited: false, apiCalls: 0 }
  const fetch: FetchLike = async (url) => {
    const isApi = url.startsWith('https://api.github.com/')
    if (isApi) state.apiCalls++
    const limited = isApi && state.rateLimited
    const body = limited ? undefined : ROUTES[url]
    const status = limited ? 403 : body === undefined ? 404 : 200
    return {
      ok: status === 200,
      status,
      json: async () => body,
      text: async () => String(body ?? ''),
      arrayBuffer: async () => new TextEncoder().encode(String(body ?? '')).buffer as ArrayBuffer,
    }
  }
  return { fetch, state }
}

let base: string
let clock: number

beforeEach(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), 'skilldex-repo-cache-'))
  clock = 1_800_000_000_000
})

afterEach(async () => {
  await fs.rm(base, { recursive: true, force: true })
})

/** A fresh workspace over the same config + cache files, like a new app launch. */
function launch(fetch: FetchLike) {
  return createSkillWorkspace({
    homeDir: path.join(base, 'home'),
    configStore: createConfigStore(path.join(base, 'config.json')),
    repoCache: createRepoCache(path.join(base, 'repo-cache.json')),
    fetchImpl: fetch,
    now: () => clock,
  })
}

describe('createRepoCache', () => {
  const scan: RepoScan = {
    catalog: {
      slug: SLUG,
      url: `https://github.com/${SLUG}`,
      ref: 'main',
      skills: [],
      linkedRepos: [],
      truncated: false,
      refreshError: 'should not be stored',
    },
    filesBySkill: new Map([[`${SLUG}:skills/tdd`, ['SKILL.md']]]),
  }

  it('keeps a scan across instances, without transient error fields', async () => {
    const file = path.join(base, 'repo-cache.json')
    await createRepoCache(file).set(SLUG, scan, 123)

    const cached = await createRepoCache(file).get(SLUG)
    expect(cached?.fetchedAt).toBe(123)
    expect(cached?.scan.catalog.refreshError).toBeUndefined()
    expect(cached?.scan.filesBySkill.get(`${SLUG}:skills/tdd`)).toEqual(['SKILL.md'])
  })

  it('treats a missing or corrupt file as an empty cache', async () => {
    const file = path.join(base, 'repo-cache.json')
    expect(await createRepoCache(file).get(SLUG)).toBeNull()
    await fs.writeFile(file, '{not json', 'utf8')
    expect(await createRepoCache(file).get(SLUG)).toBeNull()
  })

  it('forgets a deleted repo', async () => {
    const file = path.join(base, 'repo-cache.json')
    const cache = createRepoCache(file)
    await cache.set(SLUG, scan, 123)
    await cache.delete(SLUG)
    expect(await createRepoCache(file).get(SLUG)).toBeNull()
  })
})

describe('skill repos with the cache', () => {
  it('serves a recently scanned repo from disk at launch, with no GitHub API calls', async () => {
    const github = fakeGitHub()
    await launch(github.fetch).addSkillRepo(SLUG)
    const callsAfterAdd = github.state.apiCalls

    clock += REPO_CACHE_MAX_AGE_MS - 1
    const [catalog] = await launch(github.fetch).listRepoCatalogs()

    expect(github.state.apiCalls).toBe(callsAfterAdd)
    expect(catalog.skills.map((skill) => skill.name)).toEqual(['tdd'])
    expect(catalog.error).toBeUndefined()
  })

  it('rescans from GitHub once the cached scan is old', async () => {
    const github = fakeGitHub()
    await launch(github.fetch).addSkillRepo(SLUG)
    const callsAfterAdd = github.state.apiCalls

    clock += REPO_CACHE_MAX_AGE_MS + 1
    const [catalog] = await launch(github.fetch).listRepoCatalogs()

    expect(github.state.apiCalls).toBeGreaterThan(callsAfterAdd)
    expect(catalog.fetchedAt).toBe(clock)
  })

  it('shows the last good scan when GitHub is rate limited, instead of an error', async () => {
    const github = fakeGitHub()
    await launch(github.fetch).addSkillRepo(SLUG)
    const firstFetch = clock

    clock += REPO_CACHE_MAX_AGE_MS + 1
    github.state.rateLimited = true
    const [catalog] = await launch(github.fetch).listRepoCatalogs()

    expect(catalog.error).toBeUndefined()
    expect(catalog.skills.map((skill) => skill.name)).toEqual(['tdd'])
    expect(catalog.refreshError).toMatch(/rate limit/i)
    expect(catalog.fetchedAt).toBe(firstFetch)
  })

  it('keeps installs working from the cached scan', async () => {
    const github = fakeGitHub()
    await launch(github.fetch).addSkillRepo(SLUG)

    clock += REPO_CACHE_MAX_AGE_MS + 1
    github.state.rateLimited = true
    const ws = launch(github.fetch)
    await ws.listRepoCatalogs()
    await ws.installRepoSkill({ repo: SLUG, skillId: `${SLUG}:skills/tdd`, scope: 'global' })

    const installed = await fs.readFile(path.join(base, 'home', '.claude', 'skills', 'tdd', 'SKILL.md'), 'utf8')
    expect(installed).toContain('name: tdd')
  })

  it('still reports an error when GitHub fails and there is no earlier scan', async () => {
    const github = fakeGitHub()
    const ws = launch(github.fetch)
    await ws.addSkillRepo(SLUG)
    await fs.rm(path.join(base, 'repo-cache.json'))

    github.state.rateLimited = true
    const [catalog] = await launch(github.fetch).listRepoCatalogs()

    expect(catalog.error).toMatch(/rate limit/i)
    expect(catalog.skills).toEqual([])
  })

  it('always asks GitHub on Refresh, and keeps the old scan if that fails', async () => {
    const github = fakeGitHub()
    const ws = launch(github.fetch)
    await ws.addSkillRepo(SLUG)
    const callsAfterAdd = github.state.apiCalls

    github.state.rateLimited = true
    const [catalog] = await ws.refreshSkillRepo(SLUG)

    expect(github.state.apiCalls).toBeGreaterThan(callsAfterAdd)
    expect(catalog.skills.map((skill) => skill.name)).toEqual(['tdd'])
    expect(catalog.refreshError).toMatch(/rate limit/i)

    github.state.rateLimited = false
    const [refreshed] = await ws.refreshSkillRepo(SLUG)
    expect(refreshed.refreshError).toBeUndefined()
  })

  it('fetches a repo once when the list is asked for twice at the same time', async () => {
    const github = fakeGitHub()
    await launch(github.fetch).addSkillRepo(SLUG)
    await fs.rm(path.join(base, 'repo-cache.json'))
    const callsAfterAdd = github.state.apiCalls

    const ws = launch(github.fetch)
    await Promise.all([ws.listRepoCatalogs(), ws.listRepoCatalogs()])

    // One scan is two API calls (repo metadata + tree).
    expect(github.state.apiCalls - callsAfterAdd).toBe(2)
  })

  it('drops a removed repo from the cache', async () => {
    const github = fakeGitHub()
    const ws = launch(github.fetch)
    await ws.addSkillRepo(SLUG)
    await ws.removeSkillRepo(SLUG)

    expect(await createRepoCache(path.join(base, 'repo-cache.json')).get(SLUG)).toBeNull()
  })
})
