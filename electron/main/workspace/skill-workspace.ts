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
  disableSkillDir,
  enableSkillDir,
  removeSkillDir,
  scaffoldSkill,
} from './skill-manager'
import type {
  CreateSkillInput,
  SkillFile,
  SkillRecord,
  SourceRecord,
  WorkspaceConfig,
  WorkspaceSnapshot,
} from './types'

export type SkillWorkspaceDeps = {
  homeDir: string
  configStore: ConfigStore
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
  /** Scaffold a new skill folder with a SKILL.md. Returns the fresh snapshot. */
  createSkill(input: CreateSkillInput): Promise<WorkspaceSnapshot>
}

/** Management is only meaningful for skills we own on disk, never plugin skills. */
function assertManageable(skill: SkillRecord | null): asserts skill is SkillRecord {
  if (!skill) throw new Error('Unknown skill.')
  if (skill.sourceKind === 'Plugin') throw new Error('Plugin skills are managed by their plugin.')
}

export function createSkillWorkspace({ homeDir, configStore }: SkillWorkspaceDeps): SkillWorkspace {
  // Ids seen in the most recent snapshot — the allow-list guarding path access
  // so the renderer can never read or reveal an arbitrary filesystem path.
  const known = new Map<string, SkillRecord>()

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

    async createSkill(input) {
      const name = input.name.trim()
      if (!name) throw new Error('A skill name is required.')

      const config = await configStore.load()
      let root: string
      if (input.scope === 'project') {
        const dirs = await resolveProjectDirs(config.projectRoots)
        const match = dirs.find((dir) => path.basename(dir) === input.projectName)
        if (!match) throw new Error(`Unknown project: ${input.projectName ?? '(none selected)'}`)
        root = path.join(match, '.claude', 'skills')
      } else {
        root = path.join(homeDir, '.claude', 'skills')
      }

      await fs.mkdir(root, { recursive: true })
      await scaffoldSkill(root, name, input.description.trim())
      return buildSnapshot(config)
    },
  }
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
