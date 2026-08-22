/**
 * SkillWorkspace — the deep module behind the `window.skilldex` seam.
 *
 * Small interface (get config, get snapshot, configure sources); large hidden
 * implementation (multi-source scanning, dedup, per-source error isolation).
 * Dependencies are injected so tests exercise the whole thing through this
 * interface against a fixture home directory and a temp config store.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ConfigStore } from './config'
import { favouriteKeyFor } from './favourite-key'
import {
  listSkillFiles,
  resolveProjectDirs,
  scanPersonalSkills,
  scanPluginSkills,
  scanProjectSkills,
} from './filesystem-source'
import {
  downloadRepoSkill,
  fetchRepoCatalog,
  parseRepoInput,
  type FetchLike,
  type RepoScan,
} from './repo-catalog'
import {
  disableSkillDir,
  enableSkillDir,
  removeSkillDir,
  scaffoldSkill,
  slugify,
  writeSkillReadme,
} from './skill-manager'
import type {
  CreateSkillInput,
  InstallRepoSkillInput,
  RepoCatalog,
  SkillFile,
  SkillRecord,
  SourceRecord,
  WorkspaceConfig,
  WorkspaceSnapshot,
} from './types'

export type SkillWorkspaceDeps = {
  homeDir: string
  configStore: ConfigStore
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: FetchLike
}

export type SkillWorkspace = {
  getConfig(): Promise<WorkspaceConfig>
  getSnapshot(): Promise<WorkspaceSnapshot>
  configureSources(config: WorkspaceConfig): Promise<WorkspaceSnapshot>
  /** Raw SKILL.md markdown for a known skill, or null if the id is unknown. */
  getSkillReadme(id: string): Promise<string | null>
  /** Files inside a known skill's directory, or null if the id is unknown. */
  listSkillFiles(id: string): Promise<SkillFile[] | null>
  /** Absolute SKILL.md path for a known skill, for a validated reveal. Null if unknown. */
  resolveSkillPath(id: string): Promise<string | null>
  /** Move a disabled skill back into its skills root. Returns the fresh snapshot. */
  enableSkill(id: string): Promise<WorkspaceSnapshot>
  /** Park a skill in its `.disabled/` folder. Returns the fresh snapshot. */
  disableSkill(id: string): Promise<WorkspaceSnapshot>
  /** Delete a skill from disk (destructive). Returns the fresh snapshot. */
  removeSkill(id: string): Promise<WorkspaceSnapshot>
  /** Flip a skill's favourite state (persisted in config). Returns the fresh snapshot. */
  toggleFavourite(id: string): Promise<WorkspaceSnapshot>
  /** Overwrite a manageable skill's SKILL.md with new content. Returns the fresh snapshot. */
  updateSkillReadme(id: string, content: string): Promise<WorkspaceSnapshot>
  /** Scaffold a new skill folder with a SKILL.md. Returns the fresh snapshot. */
  createSkill(input: CreateSkillInput): Promise<WorkspaceSnapshot>
  /** Catalogs for every configured skill repo (per-repo errors inline, never thrown). */
  listRepoCatalogs(): Promise<RepoCatalog[]>
  /** Validate, scan, and persist a new skill repo. Returns all catalogs. */
  addSkillRepo(input: string): Promise<RepoCatalog[]>
  /** Forget a configured skill repo (never touches installed skills). Returns all catalogs. */
  removeSkillRepo(slug: string): Promise<RepoCatalog[]>
  /** Re-scan one configured skill repo. Returns all catalogs. */
  refreshSkillRepo(slug: string): Promise<RepoCatalog[]>
  /** Download a catalog skill into the global or a project skills root. */
  installRepoSkill(input: InstallRepoSkillInput): Promise<WorkspaceSnapshot>
}

/** Management is only meaningful for skills we own on disk, never plugin skills. */
function assertManageable(skill: SkillRecord | null): asserts skill is SkillRecord {
  if (!skill) throw new Error('Unknown skill.')
  if (skill.sourceKind === 'Plugin') throw new Error('Plugin skills are managed by their plugin.')
}

export function createSkillWorkspace({
  homeDir,
  configStore,
  fetchImpl = globalThis.fetch as unknown as FetchLike,
}: SkillWorkspaceDeps): SkillWorkspace {
  // Ids seen in the most recent snapshot — the allow-list guarding path access
  // so the renderer can never read or reveal an arbitrary filesystem path.
  const known = new Map<string, SkillRecord>()

  // Scanned repo catalogs, keyed by slug. Main-process memory only: the
  // renderer sees the serializable catalog, while the per-skill file lists stay
  // here so installs can only ever fetch paths we discovered ourselves.
  const repoScans = new Map<string, RepoScan>()

  async function scanRepo(slug: string, force = false): Promise<RepoScan> {
    const cached = repoScans.get(slug)
    if (cached && !force) return cached
    const scan = await fetchRepoCatalog({ slug }, fetchImpl)
    repoScans.set(slug, scan)
    return scan
  }

  async function catalogsFor(slugs: string[]): Promise<RepoCatalog[]> {
    return Promise.all(
      slugs.map(async (slug) => {
        try {
          return (await scanRepo(slug)).catalog
        } catch (cause) {
          return {
            slug,
            url: `https://github.com/${slug}`,
            ref: 'HEAD',
            skills: [],
            linkedRepos: [],
            truncated: false,
            error: cause instanceof Error ? cause.message : String(cause),
          }
        }
      }),
    )
  }

  /** Skills root for a create/install target — global, or one configured project. */
  async function resolveTargetRoot(
    config: WorkspaceConfig,
    scope: 'global' | 'project',
    projectName?: string,
  ): Promise<string> {
    if (scope === 'project') {
      const dirs = await resolveProjectDirs(config.projectRoots)
      const match = dirs.find((dir) => path.basename(dir) === projectName)
      if (!match) throw new Error(`Unknown project: ${projectName ?? '(none selected)'}`)
      return path.join(match, '.claude', 'skills')
    }
    return path.join(homeDir, '.claude', 'skills')
  }

  async function resolveKnown(id: string): Promise<SkillRecord | null> {
    if (known.has(id)) return known.get(id)!
    await buildSnapshot(await configStore.load())
    return known.get(id) ?? null
  }

  async function buildSnapshot(config: WorkspaceConfig): Promise<WorkspaceSnapshot> {
    const sources: SourceRecord[] = []
    const errors: string[] = []
    const collected: SkillRecord[] = []

    if (config.includePersonal) {
      const result = await scanPersonalSkills(homeDir)
      sources.push({ kind: 'Personal', root: '~/.claude/skills', skillCount: result.skills.length, error: result.error })
      if (result.error) errors.push(`Personal skills: ${result.error}`)
      collected.push(...result.skills)
    }

    if (config.includePlugins) {
      const result = await scanPluginSkills(homeDir)
      sources.push({ kind: 'Plugin', root: '~/.claude/plugins', skillCount: result.skills.length, error: result.error })
      if (result.error) errors.push(`Plugin skills: ${result.error}`)
      collected.push(...result.skills)
    }

    const projectScan = await scanProjectSkills(config.projectRoots, homeDir)
    if (config.projectRoots.length > 0) {
      sources.push({ kind: 'Project', root: `${projectScan.projects.length} project(s)`, skillCount: projectScan.skills.length })
    }
    errors.push(...projectScan.errors)
    collected.push(...projectScan.skills)

    const favourites = new Set(config.favourites)
    const skills = dedupe(collected).map((skill) => ({
      ...skill,
      isFavourite: favourites.has(favouriteKeyFor(skill.realPath)),
    }))

    known.clear()
    for (const skill of skills) known.set(skill.id, skill)

    return {
      skills,
      projects: projectScan.projects.sort((a, b) => a.name.localeCompare(b.name)),
      sources,
      errors,
      scannedAt: new Date().toISOString(),
      homeDir,
    }
  }

  return {
    getConfig: () => configStore.load(),

    async getSnapshot() {
      return buildSnapshot(await configStore.load())
    },

    async configureSources(config) {
      const saved = await configStore.save(config)
      return buildSnapshot(saved)
    },

    async getSkillReadme(id) {
      const skill = await resolveKnown(id)
      if (!skill) return null
      return fs.readFile(path.join(skill.realPath, 'SKILL.md'), 'utf8').catch(() => null)
    },

    async listSkillFiles(id) {
      const skill = await resolveKnown(id)
      if (!skill) return null
      return listSkillFiles(skill.realPath).catch(() => [])
    },

    async resolveSkillPath(id) {
      const skill = await resolveKnown(id)
      if (!skill) return null
      return path.join(skill.realPath, 'SKILL.md')
    },

    async enableSkill(id) {
      const skill = await resolveKnown(id)
      assertManageable(skill)
      if (!skill.enabled) await enableSkillDir(skill.path)
      return buildSnapshot(await configStore.load())
    },

    async disableSkill(id) {
      const skill = await resolveKnown(id)
      assertManageable(skill)
      if (skill.enabled) await disableSkillDir(skill.path)
      return buildSnapshot(await configStore.load())
    },

    async removeSkill(id) {
      const skill = await resolveKnown(id)
      assertManageable(skill)
      await removeSkillDir(skill.path)
      // A deleted skill can't stay favourited — prune its key so the set never
      // accumulates dead entries.
      const config = await configStore.load()
      const key = favouriteKeyFor(skill.realPath)
      const saved = config.favourites.includes(key)
        ? await configStore.save({ ...config, favourites: config.favourites.filter((k) => k !== key) })
        : config
      return buildSnapshot(saved)
    },

    async toggleFavourite(id) {
      const skill = await resolveKnown(id)
      if (!skill) throw new Error('Unknown skill.')
      const config = await configStore.load()
      const key = favouriteKeyFor(skill.realPath)
      const favourites = config.favourites.includes(key)
        ? config.favourites.filter((k) => k !== key)
        : [...config.favourites, key]
      const saved = await configStore.save({ ...config, favourites })
      return buildSnapshot(saved)
    },

    async updateSkillReadme(id, content) {
      const skill = await resolveKnown(id)
      assertManageable(skill)
      // An empty SKILL.md is never intentional and would leave the skill with no
      // instructions; block it. Any other content is written verbatim so no
      // frontmatter key is ever silently dropped.
      if (content.trim().length === 0) throw new Error('SKILL.md cannot be empty.')
      await writeSkillReadme(skill.realPath, content)
      // Identity is the directory, so `id`/`realPath` are unchanged; rebuilding
      // re-reads the frontmatter, refreshing the name/description on the card.
      return buildSnapshot(await configStore.load())
    },

    async createSkill(input) {
      const name = input.name.trim()
      if (!name) throw new Error('A skill name is required.')

      const config = await configStore.load()
      const root = await resolveTargetRoot(config, input.scope, input.projectName)
      await fs.mkdir(root, { recursive: true })
      await scaffoldSkill(root, name, input.description.trim())
      return buildSnapshot(config)
    },

    async listRepoCatalogs() {
      const config = await configStore.load()
      return catalogsFor(config.skillRepos)
    },

    async addSkillRepo(input) {
      const parsed = parseRepoInput(input)
      if (!parsed)
        throw new Error('Enter a GitHub repository like owner/repo or https://github.com/owner/repo.')

      // Scan before persisting, so a typo'd or unreachable repo is rejected
      // with the fetch error instead of being saved broken.
      const scan = await fetchRepoCatalog(parsed, fetchImpl)
      repoScans.set(parsed.slug, scan)

      const config = await configStore.load()
      const saved = config.skillRepos.includes(parsed.slug)
        ? config
        : await configStore.save({ ...config, skillRepos: [...config.skillRepos, parsed.slug] })
      return catalogsFor(saved.skillRepos)
    },

    async removeSkillRepo(slug) {
      const config = await configStore.load()
      const saved = await configStore.save({
        ...config,
        skillRepos: config.skillRepos.filter((existing) => existing !== slug),
      })
      repoScans.delete(slug)
      return catalogsFor(saved.skillRepos)
    },

    async refreshSkillRepo(slug) {
      const config = await configStore.load()
      if (config.skillRepos.includes(slug)) await scanRepo(slug, true)
      return catalogsFor(config.skillRepos)
    },

    async installRepoSkill(input) {
      const config = await configStore.load()
      // Installs are only allowed from repos the user has added, and only for
      // skills we discovered ourselves — the renderer can't name arbitrary
      // URLs or paths.
      if (!config.skillRepos.includes(input.repo)) throw new Error('Unknown skill repo.')
      const scan = await scanRepo(input.repo)
      const skill = scan.catalog.skills.find((entry) => entry.id === input.skillId)
      const files = skill && scan.filesBySkill.get(skill.id)
      if (!skill || !files) throw new Error('Unknown skill in this repo.')

      const root = await resolveTargetRoot(config, input.scope, input.projectName)
      const dirName = skill.path ? path.posix.basename(skill.path) : slugify(skill.name)
      await fs.mkdir(root, { recursive: true })
      await downloadRepoSkill({
        slug: scan.catalog.slug,
        ref: scan.catalog.ref,
        dir: skill.path,
        files,
        dest: path.join(root, dirName),
        fetchImpl,
      })

      // Record provenance for global installs the same way the skills CLI does
      // (~/.agents/.skill-lock.json), so the detail view's Source panel lights
      // up. Best-effort: a lock write failure never fails the install.
      if (input.scope === 'global') {
        await writeSkillLockEntry(homeDir, dirName, {
          source: scan.catalog.slug,
          sourceType: 'github',
          sourceUrl: `https://github.com/${scan.catalog.slug}.git`,
          skillPath: skill.path ? `${skill.path}/SKILL.md` : 'SKILL.md',
        }).catch(() => {})
      }

      return buildSnapshot(config)
    },
  }
}

/** Merge one skill's provenance entry into `~/.agents/.skill-lock.json`. */
async function writeSkillLockEntry(
  homeDir: string,
  skillDirName: string,
  entry: { source: string; sourceType: string; sourceUrl: string; skillPath: string },
): Promise<void> {
  const lockPath = path.join(homeDir, '.agents', '.skill-lock.json')
  let parsed: { skills?: Record<string, unknown> } = {}
  try {
    parsed = JSON.parse(await fs.readFile(lockPath, 'utf8'))
  } catch {
    // Missing or unparseable — start fresh.
  }
  parsed.skills = { ...(parsed.skills ?? {}), [skillDirName]: entry }
  await fs.mkdir(path.dirname(lockPath), { recursive: true })
  await fs.writeFile(lockPath, JSON.stringify(parsed, null, 2), 'utf8')
}

/**
 * Collapse skills that resolve to the same real path (e.g. a personal skill
 * symlinked into a project), keeping the first occurrence and merging the
 * projects that reference it.
 */
function dedupe(skills: SkillRecord[]): SkillRecord[] {
  const byRealPath = new Map<string, SkillRecord>()
  for (const skill of skills) {
    const existing = byRealPath.get(skill.realPath)
    if (existing) {
      existing.projects = [...new Set([...existing.projects, ...skill.projects])]
    } else {
      byRealPath.set(skill.realPath, { ...skill, projects: [...skill.projects] })
    }
  }
  return [...byRealPath.values()].sort((a, b) => a.name.localeCompare(b.name))
}
