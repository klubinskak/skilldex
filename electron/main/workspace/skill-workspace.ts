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
import {
  listSkillFiles,
  scanPersonalSkills,
  scanPluginSkills,
  scanProjectSkills,
} from './filesystem-source'
import type {
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

    const skills = dedupe(collected)

    known.clear()
    for (const skill of skills) known.set(skill.id, skill)

    return {
      skills,
      projects: projectScan.projects.sort((a, b) => a.name.localeCompare(b.name)),
      sources,
      errors,
      scannedAt: new Date().toISOString(),
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
