/**
 * The serialized mod contract that crosses the preload seam (`window.skilldex.mods`).
 *
 * A **mod** is a Claude Code plugin whose `hooks/hooks.json` lists hooks
 * `modules`: code that changes Claude's own interface or behaviour (a pane, a
 * band above the prompt, a status line, a slash command, a tool-call hook).
 */

/** Where in Claude Code a mod shows up or reaches in. */
export type ModSurface =
  | 'pane'
  | 'band'
  | 'status'
  | 'toast'
  | 'notification'
  | 'sound'
  | 'command'
  | 'tool-hook'
  | 'prompt'
  | 'system-prompt'

/** What a mod's code reaches outside itself for. */
export type ModAccess = 'processes' | 'files' | 'model' | 'tools' | 'agents'

/** What a mod does, read statically from its hooks modules. */
export type ModAnatomy = {
  surfaces: ModSurface[]
  /** Slash commands it registers, without the leading `/`. */
  commands: string[]
  /** Engine events it hooks, e.g. `session.start`, `tool.call`. */
  events: string[]
  access: ModAccess[]
}

/** Which settings file holds a mod's on/off switch. */
export type ModScope = 'user' | 'project' | 'local' | 'session'

export type ModRecord = {
  /** `name@marketplace` for installed mods; `draft:<dir>` for session drafts. */
  id: string
  name: string
  version: string
  description: string
  author?: string
  /** Marketplace it was installed from (installed mods only). */
  marketplace?: string
  /** Installed through a marketplace, or a draft Claude wrote in one session. */
  kind: 'installed' | 'draft'
  scope: ModScope
  /** Project the mod is installed for (project and local scopes). */
  projectPath?: string
  enabled: boolean
  /** Whether Skilldex can flip `enabled` (drafts are switched per session by Claude). */
  canToggle: boolean
  /** Absolute folder the engine reads the mod from. */
  path: string
  /** Display-friendly (tilde) form of `path`. */
  displayPath: string
  /** `folder` when edits to `path` apply on reload; `copy` when it runs an installed snapshot. */
  readFrom: 'folder' | 'copy'
  anatomy: ModAnatomy
  imageCount: number
  hasReadme: boolean
}

export type ModFile = {
  relativePath: string
  sizeBytes: number
}

export type ModImage = {
  relativePath: string
  /** `data:` URL, so the sandboxed renderer can show it without file access. */
  dataUrl: string
}

export type ModSource = {
  relativePath: string
  content: string
}

export type ModDetail = {
  readme: string | null
  images: ModImage[]
  files: ModFile[]
  /** The hooks modules themselves, for the Code tab. */
  sources: ModSource[]
}

export type ModsSnapshot = {
  mods: ModRecord[]
  errors: string[]
  scannedAt: string
}
