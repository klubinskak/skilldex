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
  isFavourite: boolean
  isSymlink: boolean
  fileCount: number
  projects: string[]
  origin?: SkillOrigin
}

export type SkillFile = {
  relativePath: string
  sizeBytes: number
}

// ---- security scan (mirrors electron/main/workspace/security/types.ts) ----

export type ScanVerdict = 'red' | 'amber' | 'green'
export type FindingSeverity = 'red' | 'amber'
export type FindingCategory =
  | 'pipe-to-shell'
  | 'credential-exfiltration'
  | 'obfuscated-execution'
  | 'network-access'
  | 'sensitive-path-read'
  | 'dynamic-eval'
  | 'destructive-fs'
  | 'prompt-injection'
  | 'suspicious-binary'

export type SkillFinding = {
  severity: FindingSeverity
  category: FindingCategory
  file: string
  line: number
  matchedText: string
  why: string
}

export type SkillScan = {
  verdict: ScanVerdict
  findings: SkillFinding[]
}

export type SkillScanResult = SkillScan & {
  reviewed: boolean
}

export type ScanRepoSkillInput = {
  repo: string
  skillId: string
}

/** Presentation for a verdict badge: label, dot colour, and pill classes. */
export function verdictMeta(verdict: ScanVerdict): {
  label: string
  dot: string
  pill: string
} {
  switch (verdict) {
    case 'red':
      return { label: 'Risky', dot: '#f87171', pill: 'text-[#f87171] bg-[#2a0e12] border-[#4a1a20]' }
    case 'amber':
      return { label: 'Caution', dot: '#fbbf24', pill: 'text-[#fbbf24] bg-[#2a1f09] border-[#4a3410]' }
    default:
      return { label: 'Clean', dot: '#4ade80', pill: 'text-[#4ade80] bg-[#0f1f12] border-[#1c3a22]' }
  }
}

/** Human label for a finding category, shown as the finding's heading. */
export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  'pipe-to-shell': 'Pipe to shell',
  'credential-exfiltration': 'Credential exfiltration',
  'obfuscated-execution': 'Obfuscated execution',
  'network-access': 'Network access',
  'sensitive-path-read': 'Sensitive path',
  'dynamic-eval': 'Dynamic code execution',
  'destructive-fs': 'Destructive filesystem op',
  'prompt-injection': 'Prompt injection',
  'suspicious-binary': 'Executable binary',
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
  favourites: string[]
  skillRepos: string[]
  reviewed: string[]
}

export type CreateSkillInput = {
  name: string
  description: string
  scope: 'global' | 'project'
  projectName?: string
}

export type RepoSkill = {
  id: string
  name: string
  description: string
  path: string
  fileCount: number
  webUrl: string
}

export type RepoCatalog = {
  slug: string
  url: string
  ref: string
  skills: RepoSkill[]
  linkedRepos: string[]
  truncated: boolean
  stars?: number
  error?: string
}

export type InstallRepoSkillInput = {
  repo: string
  skillId: string
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

/**
 * Whether a skill is one the user owns locally — a Personal ("global") skill
 * with no recorded upstream origin (i.e. not installed from a repo). Skills
 * carry no author metadata, so this is provenance-based ownership, not proven
 * authorship. See docs/adr/0002-owned-skills-detected-by-absent-origin.md.
 */
export function isOwned(skill: Pick<Skill, 'scope' | 'origin'>): boolean {
  return skill.scope === 'global' && !skill.origin
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
