/**
 * Renderer-side mirror of the `window.skilldex.mods` seam contract (see
 * electron/main/mods/types.ts), plus the words the UI uses for each surface.
 */

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

export type ModAccess = 'processes' | 'files' | 'model' | 'tools' | 'agents'

export type ModAnatomy = {
  surfaces: ModSurface[]
  commands: string[]
  events: string[]
  access: ModAccess[]
}

export type ModScope = 'user' | 'project' | 'local' | 'session'

export type ModRecord = {
  id: string
  name: string
  version: string
  description: string
  author?: string
  marketplace?: string
  kind: 'installed' | 'draft'
  scope: ModScope
  projectPath?: string
  enabled: boolean
  canToggle: boolean
  path: string
  displayPath: string
  readFrom: 'folder' | 'copy'
  anatomy: ModAnatomy
  imageCount: number
  hasReadme: boolean
}

export type ModFile = { relativePath: string; sizeBytes: number }
export type ModImage = { relativePath: string; dataUrl: string }
export type ModSource = { relativePath: string; content: string }

export type ModDetail = {
  readme: string | null
  images: ModImage[]
  files: ModFile[]
  sources: ModSource[]
}

export type ModsSnapshot = {
  mods: ModRecord[]
  errors: string[]
  scannedAt: string
}

export const emptyModsSnapshot: ModsSnapshot = { mods: [], errors: [], scannedAt: '' }

export const SURFACES: Record<ModSurface, { label: string; detail: string }> = {
  pane: { label: 'Pane', detail: 'Opens a panel beside the conversation.' },
  band: { label: 'Band', detail: 'Draws a row above the prompt.' },
  status: { label: 'Status line', detail: 'Writes to the status line under the prompt.' },
  toast: { label: 'Toasts', detail: 'Shows short pop-up messages.' },
  notification: { label: 'Notifications', detail: 'Sends native system notifications.' },
  sound: { label: 'Sound', detail: 'Plays sounds or speaks text.' },
  command: { label: 'Commands', detail: 'Adds slash commands.' },
  'tool-hook': { label: 'Tool hook', detail: 'Watches, rewrites or blocks Claude’s tool calls.' },
  prompt: { label: 'Prompt hook', detail: 'Reads or rewrites what you send before Claude sees it.' },
  'system-prompt': { label: 'System prompt', detail: 'Changes the instructions Claude gets.' },
}

export const ACCESS: Record<ModAccess, string> = {
  processes: 'Runs programs on your machine',
  files: 'Reads or writes files',
  model: 'Makes its own model calls',
  tools: 'Gives Claude new tools',
  agents: 'Starts subagents',
}

/** Same deterministic accent the skill cards use, keyed by mod name. */
export function modIcon(name: string): { mono: string; bg: string; fg: string } {
  const palette = [
    ['#1e1b4b', '#a5b4fc'],
    ['#052e16', '#86efac'],
    ['#2a1709', '#fdba74'],
    ['#0e1f2a', '#7dd3fc'],
    ['#3b0764', '#e9d5ff'],
    ['#3f0d12', '#fda4af'],
  ]
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const [bg, fg] = palette[hash % palette.length]
  const mono = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return { mono: mono || '?', bg, fg }
}
