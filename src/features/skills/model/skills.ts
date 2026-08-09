/**
 * Renderer-side mirror of the `window.skilldex` seam contract, plus the UI view
 * model the dashboard renders. These shapes match the plain-JSON records the
 * main process sends over IPC (see electron/main/workspace/types.ts).
 */

export type SkillSourceKind = 'Personal' | 'Plugin' | 'Project'

export type OriginHost = 'github' | 'gitlab' | 'bitbucket' | 'other'

export type SkillOrigin = {
  host: OriginHost
  label: string
  repoUrl: string
  webUrl: string
}

export type SkillRecord = {
  id: string
  name: string
  description: string
  path: string
  realPath: string
  sourceKind: SkillSourceKind
  sourceRoot: string
  displayPath: string
  enabled: boolean
  isSymlink: boolean
  fileCount: number
  projects: string[]
  origin?: SkillOrigin
}

export type SkillFile = {
  relativePath: string
  sizeBytes: number
}

export type ProjectRecord = {
  name: string
  path: string
  skillCount: number
}

export type SourceRecord = {
  kind: SkillSourceKind
  root: string
  skillCount: number
  error?: string
}

export type WorkspaceSnapshot = {
  skills: SkillRecord[]
  projects: ProjectRecord[]
  sources: SourceRecord[]
  errors: string[]
  scannedAt: string
  homeDir: string
}

/**
 * Replace a leading home directory with `~` for display. Renderer twin of the
 * one in electron/main/workspace/filesystem-source.ts (the renderer can't import
 * from main); kept in parity by skills.test.ts.
 */
export function tildify(target: string, homeDir: string): string {
  if (target === homeDir) return '~'
  if (!homeDir) return target
  const prefix = homeDir.endsWith('/') ? homeDir : homeDir + '/'
  return target.startsWith(prefix) ? '~/' + target.slice(prefix.length) : target
}

export type WorkspaceConfig = {
  includePersonal: boolean
  includePlugins: boolean
  projectRoots: string[]
}

export type CreateSkillInput = {
  name: string
  description: string
  scope: 'global' | 'project'
  projectName?: string
}

/**
 * UI scope shown on cards and filters. The mockup uses two scopes; we map our
 * three source kinds onto them: Personal → "global", Plugin → "plugin",
 * Project → "project".
 */
export type SkillScope = 'global' | 'plugin' | 'project'

/** UI view model: a record enriched with presentation-only fields. */
export type Skill = SkillRecord & {
  summary: string
  source: string
  scope: SkillScope
  /** Two-letter monogram for the icon badge. */
  mono: string
  iconBg: string
  iconFg: string
}

/** Shared accent palette (icon foreground + project dots) from the mockup. */
export const ACCENT_PALETTE = ['#fb923c', '#38bdf8', '#4ade80', '#c084fc', '#fb7185', '#2dd4bf']

// Icon badge background tints paired to each accent foreground above.
const ICON_BG = ['#2a1c0e', '#0e1f2a', '#131f12', '#1e0e2a', '#2a0e17', '#0e2a24']

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Stable colour pair per skill so a given skill always looks the same. */
export function iconColorsFor(id: string): { bg: string; fg: string } {
  const index = hash(id) % ACCENT_PALETTE.length
  return { bg: ICON_BG[index], fg: ACCENT_PALETTE[index] }
}

/** Two-letter monogram from a skill name (e.g. "pdf-form-filler" → "PD"). */
export function monoFor(name: string): string {
  const words = name.split(/[\s._-]+/).filter(Boolean)
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2)
  return letters.toUpperCase()
}

export function scopeFor(kind: SkillSourceKind): SkillScope {
  if (kind === 'Personal') return 'global'
  if (kind === 'Plugin') return 'plugin'
  return 'project'
}

/** Tailwind classes for the coloured scope pill shown on cards and detail. */
export function scopePillClass(scope: SkillScope): string {
  switch (scope) {
    case 'global':
      return 'text-[#fb923c] bg-[#2a1709] border-[#4a2a10]'
    case 'plugin':
      return 'text-[#38bdf8] bg-[#0e1f2a] border-[#123244]'
    default:
      return 'text-[#a1a1aa] bg-[#1a1a1e] border-[#2e2e34]'
  }
}

export function toSkill(record: SkillRecord): Skill {
  const colors = iconColorsFor(record.id)
  return {
    ...record,
    summary: record.description || 'No description provided.',
    source: record.displayPath,
    scope: scopeFor(record.sourceKind),
    mono: monoFor(record.name),
    iconBg: colors.bg,
    iconFg: colors.fg,
  }
}

export const emptySnapshot: WorkspaceSnapshot = {
  skills: [],
  projects: [],
  sources: [],
  errors: [],
  scannedAt: '',
  homeDir: '',
}
