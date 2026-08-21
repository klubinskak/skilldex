import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createConfigStore } from '../config'
import { downloadRepoSkill, fetchRepoCatalog, parseRepoInput, type FetchLike } from '../repo-catalog'
import { createSkillWorkspace } from '../skill-workspace'

describe('parseRepoInput', () => {
  it('accepts bare owner/repo', () => {
    expect(parseRepoInput('VoltAgent/awesome-agent-skills')).toEqual({
      slug: 'VoltAgent/awesome-agent-skills',
      ref: undefined,
    })
  })

  it('accepts full https URLs, with and without .git', () => {
    expect(parseRepoInput('https://github.com/anthropics/skills')).toEqual({ slug: 'anthropics/skills', ref: undefined })
    expect(parseRepoInput('https://github.com/anthropics/skills.git')).toEqual({ slug: 'anthropics/skills', ref: undefined })
    expect(parseRepoInput('https://www.github.com/anthropics/skills/')).toEqual({ slug: 'anthropics/skills', ref: undefined })
  })

  it('accepts scp-style remotes and host-only prefixes', () => {
    expect(parseRepoInput('git@github.com:acme/skills.git')).toEqual({ slug: 'acme/skills', ref: undefined })
    expect(parseRepoInput('github.com/acme/skills')).toEqual({ slug: 'acme/skills', ref: undefined })
  })

  it('captures a branch from /tree/<ref> URLs', () => {
    expect(parseRepoInput('https://github.com/acme/skills/tree/develop')).toEqual({ slug: 'acme/skills', ref: 'develop' })
    expect(parseRepoInput('https://github.com/acme/skills/tree/develop/some/dir')).toEqual({
      slug: 'acme/skills',
      ref: 'develop',
    })
  })

  it('rejects non-GitHub hosts, reserved segments, and junk', () => {
    expect(parseRepoInput('https://gitlab.com/acme/skills')).toBeNull()
    expect(parseRepoInput('https://github.com/topics/agent-skills')).toBeNull()
    expect(parseRepoInput('just-one-segment')).toBeNull()
    expect(parseRepoInput('')).toBeNull()
  })
})

/** Build a FetchLike serving canned GitHub API + raw responses by URL. */
function fakeGitHub(routes: Record<string, unknown>): { fetch: FetchLike; requested: string[] } {
  const requested: string[] = []
  const impl: FetchLike = async (url) => {
    requested.push(url)
    const body = routes[url]
    const ok = body !== undefined
    return {
      ok,
      status: ok ? 200 : 404,
      json: async () => body,
      text: async () => String(body ?? ''),
      arrayBuffer: async () => {
        const data = typeof body === 'string' ? body : JSON.stringify(body)
        return new TextEncoder().encode(data).buffer as ArrayBuffer
      },
    }
  }
  return { fetch: impl, requested }
}

const SLUG = 'acme/skills'
const API_REPO = `https://api.github.com/repos/${SLUG}`
const API_TREE = `${API_REPO}/git/trees/main?recursive=1`
const RAW = `https://raw.githubusercontent.com/${SLUG}/main`

function skillsRepoRoutes(): Record<string, unknown> {
  return {
    [API_REPO]: { default_branch: 'main' },
    [API_TREE]: {
      truncated: false,
      tree: [
        { path: 'README.md', type: 'blob' },
        { path: 'skills', type: 'tree' },
        { path: 'skills/pdf-filler', type: 'tree' },
        { path: 'skills/pdf-filler/SKILL.md', type: 'blob' },
        { path: 'skills/pdf-filler/scripts/run.sh', type: 'blob' },
        { path: 'skills/tdd', type: 'tree' },
        { path: 'skills/tdd/SKILL.md', type: 'blob' },
      ],
    },
    [`${RAW}/skills/pdf-filler/SKILL.md`]: '---\nname: pdf-filler\ndescription: Fill PDF forms\n---\n\n# PDF',
    [`${RAW}/skills/pdf-filler/scripts/run.sh`]: '#!/bin/sh\necho hi\n',
    [`${RAW}/skills/tdd/SKILL.md`]: '---\nname: tdd\ndescription: Test-driven development\n---\n',
  }
}

describe('fetchRepoCatalog', () => {
  it('lists every directory containing a SKILL.md, with frontmatter metadata', async () => {
    const { fetch } = fakeGitHub(skillsRepoRoutes())
    const scan = await fetchRepoCatalog({ slug: SLUG }, fetch)

    expect(scan.catalog.ref).toBe('main')
    expect(scan.catalog.skills.map((skill) => skill.name)).toEqual(['pdf-filler', 'tdd'])
    const pdf = scan.catalog.skills[0]
    expect(pdf.id).toBe(`${SLUG}:skills/pdf-filler`)
    expect(pdf.description).toBe('Fill PDF forms')
    expect(pdf.fileCount).toBe(2)
    expect(pdf.webUrl).toBe(`https://github.com/${SLUG}/tree/main/skills/pdf-filler`)
    expect(scan.filesBySkill.get(pdf.id)).toEqual(['SKILL.md', 'scripts/run.sh'])
    expect(scan.catalog.linkedRepos).toEqual([])
  })

  it('surfaces README-linked repos when the repo is an index (no SKILL.md anywhere)', async () => {
    const { fetch } = fakeGitHub({
      [API_REPO]: { default_branch: 'main' },
      [API_TREE]: {
        truncated: false,
        tree: [{ path: 'README.md', type: 'blob' }],
      },
      [`${RAW}/README.md`]: [
        'A list of skills:',
        '- [angular](https://github.com/angular/skills) framework skills',
        '- [hashicorp](https://github.com/hashicorp/skills/tree/main/terraform) infra',
        '- [self](https://github.com/acme/skills) this repo',
        '- [topic](https://github.com/topics/agent-skills) not a repo',
        '- [dup](https://github.com/angular/skills#readme) duplicate',
      ].join('\n'),
    })
    const scan = await fetchRepoCatalog({ slug: SLUG }, fetch)

    expect(scan.catalog.skills).toEqual([])
    expect(scan.catalog.linkedRepos).toEqual(['angular/skills', 'hashicorp/skills'])
  })

  it('reports friendly errors for missing repos and rate limits', async () => {
    const missing = fakeGitHub({})
    await expect(fetchRepoCatalog({ slug: 'acme/nope' }, missing.fetch)).rejects.toThrow(
      'Repository not found on GitHub: acme/nope',
    )

    const limited: FetchLike = async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    await expect(fetchRepoCatalog({ slug: SLUG }, limited)).rejects.toThrow(/rate limit/)
  })
})

describe('downloadRepoSkill', () => {
  let tmp: string
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'skilldex-repo-'))
  })
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true })
  })

  it('writes every file preserving the folder structure', async () => {
    const { fetch } = fakeGitHub(skillsRepoRoutes())
    const dest = path.join(tmp, 'pdf-filler')
    await downloadRepoSkill({
      slug: SLUG,
      ref: 'main',
      dir: 'skills/pdf-filler',
      files: ['SKILL.md', 'scripts/run.sh'],
      dest,
      fetchImpl: fetch,
    })

    expect(await fs.readFile(path.join(dest, 'SKILL.md'), 'utf8')).toContain('Fill PDF forms')
    expect(await fs.readFile(path.join(dest, 'scripts', 'run.sh'), 'utf8')).toContain('echo hi')
  })

  it('removes the partial download when any file fails', async () => {
    const { fetch } = fakeGitHub(skillsRepoRoutes())
    const dest = path.join(tmp, 'pdf-filler')
    await expect(
      downloadRepoSkill({
        slug: SLUG,
        ref: 'main',
        dir: 'skills/pdf-filler',
        files: ['SKILL.md', 'missing.txt'],
        dest,
        fetchImpl: fetch,
      }),
    ).rejects.toThrow(/missing\.txt/)
    await expect(fs.access(dest)).rejects.toThrow()
  })

  it('refuses to overwrite an existing directory', async () => {
    const { fetch } = fakeGitHub(skillsRepoRoutes())
    const dest = path.join(tmp, 'pdf-filler')
    await fs.mkdir(dest)
    await expect(
      downloadRepoSkill({ slug: SLUG, ref: 'main', dir: 'skills/pdf-filler', files: ['SKILL.md'], dest, fetchImpl: fetch }),
    ).rejects.toThrow(/already exists/)
  })
})

describe('SkillWorkspace repo integration', () => {
  let tmp: string
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'skilldex-home-'))
  })
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true })
  })

  function workspace(routes: Record<string, unknown>) {
    return createSkillWorkspace({
      homeDir: tmp,
      configStore: createConfigStore(path.join(tmp, 'config.json')),
      fetchImpl: fakeGitHub(routes).fetch,
    })
  }

  it('adds a repo, persists it, and installs a skill globally with provenance', async () => {
    const ws = workspace(skillsRepoRoutes())

    const catalogs = await ws.addSkillRepo('https://github.com/acme/skills')
    expect(catalogs).toHaveLength(1)
    expect(catalogs[0].skills).toHaveLength(2)
    expect((await ws.getConfig()).skillRepos).toEqual([SLUG])

    const snapshot = await ws.installRepoSkill({
      repo: SLUG,
      skillId: `${SLUG}:skills/pdf-filler`,
      scope: 'global',
    })

    const installed = snapshot.skills.find((skill) => skill.name === 'pdf-filler')
    expect(installed).toBeDefined()
    expect(installed?.sourceKind).toBe('Personal')
    const skillMd = await fs.readFile(path.join(tmp, '.claude', 'skills', 'pdf-filler', 'SKILL.md'), 'utf8')
    expect(skillMd).toContain('Fill PDF forms')

    const lock = JSON.parse(await fs.readFile(path.join(tmp, '.agents', '.skill-lock.json'), 'utf8'))
    expect(lock.skills['pdf-filler'].sourceUrl).toBe('https://github.com/acme/skills.git')
    // The lock entry lights up the origin panel on the next scan.
    expect(installed?.origin?.repoUrl).toBe('https://github.com/acme/skills')
  })

  it('rejects installs from repos or skills that were never added', async () => {
    const ws = workspace(skillsRepoRoutes())
    await expect(
      ws.installRepoSkill({ repo: SLUG, skillId: `${SLUG}:skills/tdd`, scope: 'global' }),
    ).rejects.toThrow('Unknown skill repo.')

    await ws.addSkillRepo(SLUG)
    await expect(
      ws.installRepoSkill({ repo: SLUG, skillId: `${SLUG}:not/there`, scope: 'global' }),
    ).rejects.toThrow('Unknown skill in this repo.')
  })

  it('rejects duplicate installs instead of overwriting', async () => {
    const ws = workspace(skillsRepoRoutes())
    await ws.addSkillRepo(SLUG)
    await ws.installRepoSkill({ repo: SLUG, skillId: `${SLUG}:skills/tdd`, scope: 'global' })
    await expect(
      ws.installRepoSkill({ repo: SLUG, skillId: `${SLUG}:skills/tdd`, scope: 'global' }),
    ).rejects.toThrow(/already exists/)
  })

  it('lists per-repo errors inline instead of failing the whole list', async () => {
    const ws = workspace({})
    await expect(ws.addSkillRepo('acme/gone')).rejects.toThrow('Repository not found on GitHub: acme/gone')
    // Nothing persisted after the failed add.
    expect((await ws.getConfig()).skillRepos).toEqual([])
  })

  it('removes a repo from config without touching installed skills', async () => {
    const ws = workspace(skillsRepoRoutes())
    await ws.addSkillRepo(SLUG)
    await ws.installRepoSkill({ repo: SLUG, skillId: `${SLUG}:skills/tdd`, scope: 'global' })

    const catalogs = await ws.removeSkillRepo(SLUG)
    expect(catalogs).toEqual([])
    expect((await ws.getConfig()).skillRepos).toEqual([])
    await expect(fs.access(path.join(tmp, '.claude', 'skills', 'tdd', 'SKILL.md'))).resolves.toBeUndefined()
  })
})
