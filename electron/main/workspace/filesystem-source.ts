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
import type { ProjectRecord, SkillFile, SkillRecord } from './types'

/** Everything `readSkill` needs beyond the directory itself. */
type ReadContext = {
  sourceKind: SkillRecord['sourceKind']
  sourceRoot: string
  homeDir: string
  projects: string[]
  enabled: boolean
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
    // Favourite state lives in config, not on disk; SkillWorkspace stamps it.
    isFavourite: false,
    isSymlink,
    fileCount,
    projects: ctx.projects,
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
  try {
    return { skills: await readEnabledAndDisabled(root, { sourceKind: 'Personal', sourceRoot: root, homeDir, projects: [] }) }
  } catch (error) {
    return { skills: [], error: describe(error) }
  }
}

// Scans `.../marketplaces/<mkt>/{plugins,external_plugins}/<plugin>/skills/<skill>/SKILL.md`.
export async function scanPluginSkills(homeDir: string): Promise<ScanResult> {
  const marketplaces = path.join(homeDir, '.claude', 'plugins', 'marketplaces')
  if (!(await exists(marketplaces))) return { skills: [] }

  try {
    const skills: SkillRecord[] = []
    for (const marketplace of await fs.readdir(marketplaces)) {
      for (const bucket of ['plugins', 'external_plugins']) {
        const bucketDir = path.join(marketplaces, marketplace, bucket)
        if (!(await exists(bucketDir))) continue
        for (const plugin of await fs.readdir(bucketDir)) {
          const skillsDir = path.join(bucketDir, plugin, 'skills')
          if (!(await exists(skillsDir))) continue
          const root = path.join(homeDir, '.claude', 'plugins')
          skills.push(...(await readSkillsIn(skillsDir, { sourceKind: 'Plugin', sourceRoot: root, homeDir, projects: [], enabled: true })))
        }
      }
    }
    return { skills }
  } catch (error) {
    return { skills: [], error: describe(error) }
  }
}

/**
 * Scan configured project roots. A root that has `.claude/skills` is itself a
 * project; otherwise its immediate children that have `.claude/skills` are.
 */
export async function scanProjectSkills(projectRoots: string[], homeDir: string): Promise<ProjectScanResult> {
  const skills: SkillRecord[] = []
  const projects: ProjectRecord[] = []
  const errors: string[] = []

  for (const root of projectRoots) {
    try {
      for (const projectDir of await projectDirsUnder(root)) {
        const name = path.basename(projectDir)
        const skillsDir = path.join(projectDir, '.claude', 'skills')
        const found = await readEnabledAndDisabled(skillsDir, { sourceKind: 'Project', sourceRoot: projectDir, homeDir, projects: [name] })
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
