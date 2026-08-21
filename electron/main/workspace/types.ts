/**
 * The serialized contract that crosses the preload seam (`window.skilldex`).
 *
 * These are plain-JSON shapes: the renderer receives exactly these records over
 * IPC and never touches Node. Absolute `path` / `realPath` are kept for future
 * management writes; `sourceRoot` is a display-friendly (tilde) label.
 */

export type SkillSourceKind = 'Personal' | 'Plugin' | 'Project'

export type SkillRecord = {
  /** Stable identity across scans and across the roots a skill is surfaced from. */
  id: string
  name: string
  description: string
  /** Absolute path to the skill directory as discovered (may be a symlink). */
  path: string
  /** Symlinks resolved — the canonical on-disk location. */
  realPath: string
  sourceKind: SkillSourceKind
  /** Display-friendly root label, e.g. `~/.claude/skills`. */
  sourceRoot: string
  /** Display-friendly full path to this skill's directory, e.g. `~/.claude/skills/tdd`. */
  displayPath: string
  enabled: boolean
  /** Whether the user has favourited this skill (persisted in config). */
  isFavourite: boolean
  isSymlink: boolean
  /** Number of files inside the skill directory. */
  fileCount: number
  /** Project names that reference this skill (Project skills only). */
  projects: string[]
  /** Upstream provenance, when the skill's manifest records where it came from. */
  origin?: SkillOrigin
}

export type SkillFile = {
  /** Path relative to the skill directory, e.g. `SKILL.md` or `scripts/run.sh`. */
  relativePath: string
  sizeBytes: number
}

/** Which git host a skill's upstream lives on (drives the deep-link URL shape). */
export type OriginHost = 'github' | 'gitlab' | 'bitbucket' | 'other'

/**
 * Where a skill came from — resolved from the manifest that records provenance
 * for its source kind (personal → `.skill-lock.json`, plugin → `marketplace.json`,
 * project → `.git/config`). Absent on locally-authored skills with no upstream.
 */
export type SkillOrigin = {
  host: OriginHost
  /** Human label, e.g. `vercel-labs/skills`. */
  label: string
  /** Browsable repository root, e.g. `https://github.com/vercel-labs/skills`. */
  repoUrl: string
  /** Deep link to this skill's folder within the repo, e.g. `.../tree/HEAD/skills/find-skills`. */
  webUrl: string
}

export type ProjectRecord = {
  name: string
  /** Display-friendly project path. */
  path: string
  skillCount: number
}

export type SourceRecord = {
  kind: SkillSourceKind
  /** Display-friendly root label. */
  root: string
  skillCount: number
  /** Present when this source could not be scanned. */
  error?: string
}

export type WorkspaceSnapshot = {
  skills: SkillRecord[]
  projects: ProjectRecord[]
  sources: SourceRecord[]
  errors: string[]
  /** ISO timestamp of the scan. */
  scannedAt: string
  /** Absolute home directory, so the renderer can tildify absolute paths. */
  homeDir: string
}

export type WorkspaceConfig = {
  includePersonal: boolean
  includePlugins: boolean
  /**
   * Absolute directories to scan for project skills. Each root is either a
   * project itself (contains `.claude/skills`) or a workspace whose immediate
   * children are projects.
   */
  projectRoots: string[]
  /**
   * Favourited skills, stored as `.disabled/`-normalized real paths (see
   * favourite-key.ts) so a favourite survives a skill being enabled/disabled.
   */
  favourites: string[]
  /** User-added GitHub skill repos, stored as normalized `owner/repo` slugs. */
  skillRepos: string[]
}

export type CreateSkillInput = {
  name: string
  description: string
  scope: 'global' | 'project'
  /** Project directory name (from a ProjectRecord); required when scope is 'project'. */
  projectName?: string
}

/** A skill discovered inside a remote GitHub repo (not yet on disk). */
export type RepoSkill = {
  /** Catalog id: `<owner>/<repo>:<dir-within-repo>` (dir is '' for a root-level skill). */
  id: string
  name: string
  description: string
  /** Directory path within the repo, '' when SKILL.md sits at the repo root. */
  path: string
  /** Number of files inside the skill's folder, per the repo tree. */
  fileCount: number
  /** Deep link to the skill's folder on github.com. */
  webUrl: string
}

/** The scanned contents of one user-added GitHub skill repo. */
export type RepoCatalog = {
  /** Normalized `owner/repo`. */
  slug: string
  /** Browsable repository root, e.g. `https://github.com/owner/repo`. */
  url: string
  /** The branch the catalog was scanned at. */
  ref: string
  skills: RepoSkill[]
  /**
   * When the repo contains no skills but its README links to other GitHub
   * repos (an "awesome list"), those `owner/repo` slugs — offered as one-click
   * additions instead of a dead-end empty catalog.
   */
  linkedRepos: string[]
  /** True when the listing was cut off (huge repo tree or skill cap reached). */
  truncated: boolean
  /** Present when the repo could not be scanned (network, rate limit, 404). */
  error?: string
}

export type InstallRepoSkillInput = {
  /** `owner/repo` slug of a configured skill repo. */
  repo: string
  /** RepoSkill catalog id within that repo. */
  skillId: string
  scope: 'global' | 'project'
  /** Project directory name (from a ProjectRecord); required when scope is 'project'. */
  projectName?: string
}

export const defaultConfig: WorkspaceConfig = {
  includePersonal: true,
  includePlugins: true,
  projectRoots: [],
  favourites: [],
  skillRepos: [],
}
