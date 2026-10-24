/**
 * Reads what a mod does from its hooks modules' source, without running it.
 * Static and best-effort: it looks for the engine calls a mod makes
 * (`on('tool.call', ...)`, `$.ui.open(...)`), so code that builds those names
 * dynamically is missed. Good enough to say "adds a pane and /watki".
 */

import type { ModAccess, ModAnatomy, ModSurface } from './types'

const SURFACE_PATTERNS: Array<[ModSurface, RegExp]> = [
  ['pane', /\$\.ui\.open\s*\(|component:\s*['"]Pane['"]/],
  ['band', /component:\s*['"]AbovePrompt['"]/],
  ['status', /\$\.ui\.status\s*\(/],
  ['toast', /\$\.ui\.toast\s*\(/],
  ['notification', /\$\.ui\.notify\s*\(/],
  ['sound', /\$\.audio\.(play|speak)\s*\(/],
  ['command', /\$\.command\.register\s*\(/],
  ['tool-hook', /\bon\(\s*['"]tool\.(call|check)['"]/],
  ['prompt', /\bon\(\s*['"]prompt\.submit['"]/],
  ['system-prompt', /\bon\(\s*['"]prompt\.compose['"]/],
]

const ACCESS_PATTERNS: Array<[ModAccess, RegExp]> = [
  ['processes', /\$\.process\./],
  ['files', /\$\.fs\./],
  ['model', /\$\.model\./],
  ['tools', /\$\.tool\.register\s*\(/],
  ['agents', /\$\.agent\./],
]

const EVENT = /\bon\(\s*['"]([a-z]+(?:\.[a-z]+)+)['"]/g
const COMMAND_REGISTER = /\$\.command\.register\(\s*\{[^}]*?\bname:\s*['"]([^'"]+)['"]/g
const COMMAND_RUN = /\bon\(\s*['"]command\.run['"]\s*,\s*\{[^}]*?\bcommand:\s*['"]([^'"]+)['"]/g

export const emptyAnatomy: ModAnatomy = { surfaces: [], commands: [], events: [], access: [] }

export function readAnatomy(sources: string[]): ModAnatomy {
  const code = sources.join('\n')
  const matches = (pattern: RegExp) => [...code.matchAll(pattern)].map((match) => match[1])
  return {
    surfaces: SURFACE_PATTERNS.filter(([, pattern]) => pattern.test(code)).map(([surface]) => surface),
    commands: unique([...matches(COMMAND_REGISTER), ...matches(COMMAND_RUN)]),
    events: unique(matches(EVENT)),
    access: ACCESS_PATTERNS.filter(([, pattern]) => pattern.test(code)).map(([access]) => access),
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort()
}
