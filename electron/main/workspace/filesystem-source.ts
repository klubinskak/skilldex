/**
 * Filesystem adapter: turns skill directories on disk into `SkillRecord`s.
 *
 * Internal to `SkillWorkspace` — not part of the seam. Reads real files, so
 * tests point it at fixture directory trees rather than the host machine.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { parseFrontmatter } from './frontmatter'
import { DISABLED_DIR } from './skill-manager'
import {
  parseRemoteUrl,
  personalOrigin,
  pluginOrigin,
  projectOrigin,
  type PluginSource,
  type RemoteInfo,
  type SkillLockEntry,
} from './skill-origin'
import type { ProjectRecord, SkillFile, SkillOrigin, SkillRecord } from './types'

/** Everything `readSkill` needs beyond the directory itself. */
type ReadContext = {
  sourceKind: SkillRecord['sourceKind']
  sourceRoot: string
  homeDir: string
  projects: string[]
  enabled: boolean
  /** Resolve upstream provenance for a discovered skill dir, if the source records it. */
  originFor?: (skillDir: string) => SkillOrigin | undefined
}

export type ScanResult = {
  skills: SkillRecord[]
  error?: string
}

export type ProjectScanResult = {
  skills: SkillRecord[]
  projects: ProjectRecord[]
  errors: string[]
}

/** Replace a leading home directory with `~` for display. */
export function tildify(target: string, homeDir: string): string {
  if (target === homeDir) return '~'
  const prefix = homeDir.endsWith(path.sep) ? homeDir : homeDir + path.sep
  return target.startsWith(prefix) ? '~' + path.sep + target.slice(prefix.length) : target
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

/**
 * List every file inside a skill directory (recursively), relative to it, with
 * sizes. Directories are followed but not emitted. Symlinks are not followed
 * beyond the entry itself to avoid cycles.
 */
export async function listSkillFiles(skillDir: string): Promise<SkillFile[]> {
  const files: SkillFile[] = []
  async function walk(current: string, prefix: string) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute, relativePath)
      } else if (entry.isFile()) {
        const stat = await fs.stat(absolute).catch(() => null)
        files.push({ relativePath, sizeBytes: stat?.size ?? 0 })
      }
    }
  }
  await walk(skillDir, '')
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

/** List immediate child directories of `dir` that contain a `SKILL.md`. */
async function listSkillDirs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const dirs: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    const skillDir = path.join(dir, entry.name)
    if (await exists(path.join(skillDir, 'SKILL.md'))) dirs.push(skillDir)
  }
  return dirs
}

async function readSkill(skillDir: string, ctx: ReadContext): Promise<SkillRecord> {
  const skillMd = path.join(skillDir, 'SKILL.md')
  const content = await fs.readFile(skillMd, 'utf8')
  const frontmatter = parseFrontmatter(content)

  const info = await fs.lstat(skillDir)
  const isSymlink = info.isSymbolicLink()
  let realPath = skillDir
  try {
    realPath = await fs.realpath(skillDir)
  } catch {
    // Broken symlink: fall back to the discovered path.
  }

  const fileCount = await listSkillFiles(skillDir)
    .then((files) => files.length)
    .catch(() => 0)

  const origin = ctx.originFor?.(skillDir)

  return {
    id: realPath,
    name: frontmatter.name?.trim() || path.basename(skillDir),
    description: frontmatter.description?.trim() ?? '',
    path: skillDir,
    realPath,
    sourceKind: ctx.sourceKind,
    sourceRoot: tildify(ctx.sourceRoot, ctx.homeDir),
    displayPath: tildify(realPath, ctx.homeDir),
    enabled: ctx.enabled,
    isSymlink,
    fileCount,
    projects: ctx.projects,
    ...(origin ? { origin } : {}),
  }
}

async function readSkillsIn(skillsRoot: string, ctx: ReadContext): Promise<SkillRecord[]> {
  const dirs = await listSkillDirs(skillsRoot)
  const skills: SkillRecord[] = []
  for (const dir of dirs) {
    try {
      skills.push(await readSkill(dir, ctx))
    } catch {
      // Skip an unreadable individual skill; surface the source, not the noise.
    }
  }
  return skills
}

/**
 * Read the enabled skills directly under a root, plus any disabled ones parked
 * in its `.disabled/` sibling (surfaced with `enabled: false`).
 */
async function readEnabledAndDisabled(
  skillsRoot: string,
  ctx: Omit<ReadContext, 'enabled'>,
): Promise<SkillRecord[]> {
  const skills = await readSkillsIn(skillsRoot, { ...ctx, enabled: true })
  const disabledRoot = path.join(skillsRoot, DISABLED_DIR)
  if (await exists(disabledRoot)) {
    skills.push(...(await readSkillsIn(disabledRoot, { ...ctx, enabled: false })))
  }
  return skills
}

// Scans `~/.claude/skills/<skill>/SKILL.md`.
export async function scanPersonalSkills(homeDir: string): Promise<ScanResult> {
  const root = path.join(homeDir, '.claude', 'skills')
  if (!(await exists(root))) return { skills: [] }
  // Provenance for personal skills lives in the skills installer's lock file,
  // keyed by the installed skill folder name.
  const lock = await loadSkillLock(homeDir)
  const originFor = (skillDir: string) => personalOrigin(lock[path.basename(skillDir)]) ?? undefined
  try {
    return {
      skills: await readEnabledAndDisabled(root, { sourceKind: 'Personal', sourceRoot: root, homeDir, projects: [], originFor }),
    }
  } catch (error) {
    return { skills: [], error: describe(error) }
  }
}

/** Read `~/.agents/.skill-lock.json`'s `skills` map; empty when absent or unparseable. */
async function loadSkillLock(homeDir: string): Promise<Record<string, SkillLockEntry>> {
  const lockPath = path.join(homeDir, '.agents', '.skill-lock.json')
  try {
    const parsed = JSON.parse(await fs.readFile(lockPath, 'utf8'))
    return (parsed?.skills as Record<string, SkillLockEntry>) ?? {}
  } catch {
    return {}
  }
}

// Scans `.../marketplaces/<mkt>/{plugins,external_plugins}/<plugin>/skills/<skill>/SKILL.md`.
export async function scanPluginSkills(homeDir: string): Promise<ScanResult> {
  const marketplaces = path.join(homeDir, '.claude', 'plugins', 'marketplaces')
  if (!(await exists(marketplaces))) return { skills: [] }

  try {
    const skills: SkillRecord[] = []
    const root = path.join(homeDir, '.claude', 'plugins')
    // The repo backing each marketplace — used for plugins that ship inside it.
    const marketplaceRepos = await loadMarketplaceRepos(homeDir)
    // marketplace.json is read once per marketplace and reused across its plugins.
    const pluginSources = new Map<string, Map<string, PluginSource>>()
    for (const marketplace of await fs.readdir(marketplaces)) {
      const marketplaceDir = path.join(marketplaces, marketplace)
      const marketplaceRepo = marketplaceRepos.get(marketplace) ?? null
      for (const bucket of ['plugins', 'external_plugins']) {
        const bucketDir = path.join(marketplaceDir, bucket)
        if (!(await exists(bucketDir))) continue
        for (const plugin of await fs.readdir(bucketDir)) {
          const skillsDir = path.join(bucketDir, plugin, 'skills')
          if (!(await exists(skillsDir))) continue
          if (!pluginSources.has(marketplace)) pluginSources.set(marketplace, await loadMarketplacePlugins(marketplaceDir))
          const source = pluginSources.get(marketplace)!.get(plugin)
          const originFor = (skillDir: string) =>
            pluginOrigin(source, path.basename(skillDir), marketplaceRepo) ?? undefined
          skills.push(
            ...(await readSkillsIn(skillsDir, { sourceKind: 'Plugin', sourceRoot: root, homeDir, projects: [], enabled: true, originFor })),
          )
        }
      }
    }
    return { skills }
  } catch (error) {
    return { skills: [], error: describe(error) }
  }
}

/** Map marketplace name → the repo it was cloned from, per `known_marketplaces.json`. */
async function loadMarketplaceRepos(homeDir: string): Promise<Map<string, RemoteInfo>> {
  const repos = new Map<string, RemoteInfo>()
  try {
    const file = path.join(homeDir, '.claude', 'plugins', 'known_marketplaces.json')
    const data = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, { source?: { source?: string; repo?: string } }>
    for (const [name, entry] of Object.entries(data)) {
      const src = entry?.source
      if (src?.source === 'github' && src.repo) {
        const info = parseRemoteUrl(`https://github.com/${src.repo}.git`)
        if (info) repos.set(name, info)
      }
    }
  } catch {
    // No manifest: string-sourced plugins simply resolve no origin.
  }
  return repos
}

/** Map a marketplace's plugin name → its upstream `source`, following renames. */
async function loadMarketplacePlugins(marketplaceDir: string): Promise<Map<string, PluginSource>> {
  const sources = new Map<string, PluginSource>()
  try {
    const file = path.join(marketplaceDir, '.claude-plugin', 'marketplace.json')
    const data = JSON.parse(await fs.readFile(file, 'utf8'))
    for (const plugin of data.plugins ?? []) {
      if (plugin?.name && plugin?.source) sources.set(plugin.name, plugin.source)
    }
    for (const [from, to] of Object.entries((data.renames ?? {}) as Record<string, string>)) {
      const source = sources.get(from)
      if (source) sources.set(to, source)
    }
  } catch {
    // No manifest (or unreadable): plugins simply resolve no origin.
  }
  return sources
}

/**
 * Scan configured project roots. A root that has `.claude/skills` is itself a
 * project; otherwise its immediate children that have `.claude/skills` are.
 */
export async function scanProjectSkills(projectRoots: string[], homeDir: string): Promise<ProjectScanResult> {
  const skills: SkillRecord[] = []
  const projects: ProjectRecord[] = []
  const errors: string[] = []
  const gitCache = new Map<string, GitMeta | null>()

  for (const root of projectRoots) {
    try {
      for (const projectDir of await projectDirsUnder(root)) {
        const name = path.basename(projectDir)
        const skillsDir = path.join(projectDir, '.claude', 'skills')
        const git = await loadGitMeta(projectDir, gitCache)
        const originFor = git
          ? (skillDir: string) =>
              projectOrigin({ gitConfig: git.config, head: git.head, skillRelPath: toPosix(path.relative(git.root, skillDir)) }) ?? undefined
          : undefined
        const found = await readEnabledAndDisabled(skillsDir, { sourceKind: 'Project', sourceRoot: projectDir, homeDir, projects: [name], originFor })
        if (found.length === 0) continue
        skills.push(...found)
        projects.push({ name, path: tildify(projectDir, homeDir), skillCount: found.length })
      }
    } catch (error) {
      errors.push(`${tildify(root, homeDir)}: ${describe(error)}`)
    }
  }

  return { skills, projects, errors }
}

type GitMeta = { root: string; config: string; head: string | null }

/** Read the enclosing clone's `.git/config` + `HEAD`, walking up and memoizing by repo root. */
async function loadGitMeta(startDir: string, cache: Map<string, GitMeta | null>): Promise<GitMeta | null> {
  const root = await findGitRoot(startDir)
  if (!root) return null
  if (cache.has(root)) return cache.get(root)!
  let meta: GitMeta | null = null
  try {
    const config = await fs.readFile(path.join(root, '.git', 'config'), 'utf8')
    const head = await fs.readFile(path.join(root, '.git', 'HEAD'), 'utf8').catch(() => null)
    meta = { root, config, head }
  } catch {
    // `.git` is a worktree file or otherwise unreadable — no origin.
  }
  cache.set(root, meta)
  return meta
}

/** Nearest ancestor (inclusive) containing a `.git`, or null. */
async function findGitRoot(startDir: string): Promise<string | null> {
  let dir = startDir
  for (let depth = 0; depth < 40; depth++) {
    if (await exists(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function toPosix(target: string): string {
  return target.split(path.sep).join('/')
}

/**
 * Project directories under a picked root: the root itself if it has
 * `.claude/skills`, PLUS every immediate child that has `.claude/skills`. These
 * are not mutually exclusive — a folder can be its own project and a parent of
 * others (e.g. `~/Desktop/coding` with shared skills and many sub-projects).
 */
async function projectDirsUnder(root: string): Promise<string[]> {
  const dirs: string[] = []
  if (await exists(path.join(root, '.claude', 'skills'))) dirs.push(root)
  dirs.push(...(await expandWorkspace(root)))
  return dirs
}

async function expandWorkspace(root: string): Promise<string[]> {
  const children = await fs.readdir(root, { withFileTypes: true })
  const projects: string[] = []
  for (const child of children) {
    if (!child.isDirectory()) continue
    const projectDir = path.join(root, child.name)
    if (await exists(path.join(projectDir, '.claude', 'skills'))) projects.push(projectDir)
  }
  return projects
}

/** Absolute project directories under the configured roots (for skill creation). */
export async function resolveProjectDirs(projectRoots: string[]): Promise<string[]> {
  const dirs: string[] = []
  for (const root of projectRoots) {
    try {
      dirs.push(...(await projectDirsUnder(root)))
    } catch {
      // A root that can't be read is reported by scanProjectSkills, not here.
    }
  }
  return dirs
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
