/**
 * Finds the Claude Code mods on this machine and switches them on and off.
 *
 * Installed mods come from `~/.claude/plugins/installed_plugins.json`; each is
 * read from its marketplace folder when that marketplace is a local directory
 * (edits apply on `/reload-plugins`), else from the installed copy. Their
 * on/off switch is `enabledPlugins["name@marketplace"]` in the settings file of
 * the scope they were installed at, the same key `claude plugin enable` writes.
 *
 * Drafts are mods Claude wrote in one session under `~/.claude/dev-mods/`; the
 * session itself decides whether they load, so they are listed read-only.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { emptyAnatomy, readAnatomy } from './mod-anatomy'
import type { ModDetail, ModFile, ModImage, ModRecord, ModScope, ModSource, ModsSnapshot } from './types'

export type ModCatalog = {
  list(): Promise<ModsSnapshot>
  setEnabled(id: string, enabled: boolean): Promise<ModsSnapshot>
  getDetail(id: string): Promise<ModDetail | null>
  resolvePath(id: string): Promise<string | null>
}

type InstallEntry = {
  scope?: string
  installPath?: string
  version?: string
  projectPath?: string
}

type Manifest = {
  name?: string
  version?: string
  description?: string
  author?: { name?: string } | string
  hooks?: unknown
}

type Found = ModRecord & { settingsFile: string | null; settingsKey: string; modulePaths: string[] }

const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}
const MAX_IMAGES = 12
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MAX_SOURCE_BYTES = 512 * 1024
// The engine writes ~14k lines of API typings into `.claude-plugin/types/`; they are not the mod.
const SKIP_DIRS = new Set(['node_modules', '.git', path.join('.claude-plugin', 'types')])

export function createModCatalog({ homeDir }: { homeDir: string }): ModCatalog {
  const claudeDir = path.join(homeDir, '.claude')
  const tildify = (target: string) =>
    target === homeDir || target.startsWith(homeDir + path.sep) ? `~${target.slice(homeDir.length)}` : target

  function settingsFileFor(scope: ModScope, projectPath?: string): string | null {
    if (scope === 'user') return path.join(claudeDir, 'settings.json')
    if (!projectPath) return null
    if (scope === 'project') return path.join(projectPath, '.claude', 'settings.json')
    if (scope === 'local') return path.join(projectPath, '.claude', 'settings.local.json')
    return null
  }

  async function findAll(): Promise<{ mods: Found[]; errors: string[] }> {
    const errors: string[] = []
    const mods: Found[] = []

    const installed = (await readJson(path.join(claudeDir, 'plugins', 'installed_plugins.json'))) as
      | { plugins?: Record<string, InstallEntry[]> }
      | null
    const marketplaces = ((await readJson(path.join(claudeDir, 'plugins', 'known_marketplaces.json'))) ?? {}) as Record<
      string,
      { source?: { source?: string }; installLocation?: string }
    >

    for (const [key, entries] of Object.entries(installed?.plugins ?? {})) {
      const [pluginName, marketplace] = splitKey(key)
      for (const entry of Array.isArray(entries) ? entries : []) {
        try {
          const scope = toScope(entry.scope)
          const folder = await folderFromMarketplace(marketplaces[marketplace], pluginName)
          const dir = folder ?? entry.installPath
          if (!dir) continue
          const modulePaths = await hooksModules(dir)
          if (modulePaths.length === 0) continue // a plugin, but not a mod

          const settingsFile = settingsFileFor(scope, entry.projectPath)
          const settings = settingsFile ? await readJson(settingsFile) : null
          const enabledPlugins = (settings as { enabledPlugins?: Record<string, unknown> } | null)?.enabledPlugins
          mods.push({
            ...(await describe(dir, modulePaths, pluginName)),
            id: scope === 'user' ? key : `${key}#${scope}:${entry.projectPath ?? ''}`,
            version: entry.version ?? (await readManifest(dir))?.version ?? '0.0.0',
            marketplace,
            kind: 'installed',
            scope,
            projectPath: entry.projectPath,
            enabled: enabledPlugins?.[key] === true,
            canToggle: settingsFile !== null,
            readFrom: folder ? 'folder' : 'copy',
            settingsFile,
            settingsKey: key,
          })
        } catch (cause) {
          errors.push(`${key}: ${message(cause)}`)
        }
      }
    }

    // Session drafts: ~/.claude/dev-mods/<session-id>/<mod-name>/
    for (const session of await subdirs(path.join(claudeDir, 'dev-mods'))) {
      for (const dir of await subdirs(session)) {
        try {
          const modulePaths = await hooksModules(dir)
          if (modulePaths.length === 0) continue
          const described = await describe(dir, modulePaths, path.basename(dir))
          mods.push({
            ...described,
            id: `draft:${dir}`,
            version: (await readManifest(dir))?.version ?? '0.0.0',
            kind: 'draft',
            scope: 'session',
            enabled: false,
            canToggle: false,
            readFrom: 'folder',
            settingsFile: null,
            settingsKey: '',
          })
        } catch (cause) {
          errors.push(`${tildify(dir)}: ${message(cause)}`)
        }
      }
    }

    mods.sort((a, b) => Number(a.kind === 'draft') - Number(b.kind === 'draft') || a.name.localeCompare(b.name))
    return { mods, errors }
  }

  async function describe(dir: string, modulePaths: string[], fallbackName: string) {
    const manifest = await readManifest(dir)
    const sources = await Promise.all(modulePaths.map((file) => fs.readFile(file, 'utf8').catch(() => '')))
    const files = await listFiles(dir)
    const author = typeof manifest?.author === 'string' ? manifest.author : manifest?.author?.name
    return {
      name: manifest?.name ?? fallbackName,
      description: manifest?.description ?? '',
      author,
      path: dir,
      displayPath: tildify(dir),
      anatomy: sources.some(Boolean) ? readAnatomy(sources) : emptyAnatomy,
      imageCount: Math.min(files.filter((file) => isImage(file.relativePath)).length, MAX_IMAGES),
      hasReadme: files.some((file) => /^readme\.md$/i.test(file.relativePath)),
      modulePaths,
    }
  }

  async function find(id: string): Promise<Found | null> {
    return (await findAll()).mods.find((mod) => mod.id === id) ?? null
  }

  const snapshot = async (): Promise<ModsSnapshot> => {
    const { mods, errors } = await findAll()
    return { mods: mods.map(toRecord), errors, scannedAt: new Date().toISOString() }
  }

  return {
    list: snapshot,

    async setEnabled(id, enabled) {
      const mod = await find(id)
      if (!mod) throw new Error('That mod is no longer installed.')
      if (!mod.canToggle || !mod.settingsFile) {
        throw new Error('Session drafts are switched on by the Claude session that wrote them.')
      }
      await writeEnabled(mod.settingsFile, mod.settingsKey, enabled)
      return snapshot()
    },

    async getDetail(id) {
      const mod = await find(id)
      if (!mod) return null
      const files = await listFiles(mod.path)
      const readmeFile = files.find((file) => /^readme\.md$/i.test(file.relativePath))
      const readme = readmeFile ? await fs.readFile(path.join(mod.path, readmeFile.relativePath), 'utf8') : null
      return {
        readme,
        images: await readImages(mod.path, files, readme),
        files,
        sources: await readSources(mod.path, mod.modulePaths),
      }
    },

    async resolvePath(id) {
      return (await find(id))?.path ?? null
    },
  }
}

function toRecord({ settingsFile: _file, settingsKey: _key, modulePaths: _modules, ...record }: Found): ModRecord {
  return record
}

/** Set `enabledPlugins[key]` in a settings file, keeping every other setting as it was. */
export async function writeEnabled(settingsFile: string, key: string, enabled: boolean): Promise<void> {
  let settings: Record<string, unknown> = {}
  try {
    const raw = await fs.readFile(settingsFile, 'utf8')
    if (raw.trim()) settings = JSON.parse(raw) as Record<string, unknown>
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') {
      // Never overwrite a settings file we could not read: it holds far more than mods.
      throw new Error(`Could not read ${path.basename(settingsFile)}: ${message(cause)}`)
    }
  }
  const current = settings.enabledPlugins
  const enabledPlugins = current && typeof current === 'object' && !Array.isArray(current) ? current : {}
  settings.enabledPlugins = { ...enabledPlugins, [key]: enabled }

  await fs.mkdir(path.dirname(settingsFile), { recursive: true })
  const tmp = `${settingsFile}.${process.pid}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  await fs.rename(tmp, settingsFile)
}

/** Absolute paths of the hooks modules a plugin folder lists; empty when it is not a mod. */
export async function hooksModules(dir: string): Promise<string[]> {
  const manifest = await readManifest(dir)
  const hooksFile =
    typeof manifest?.hooks === 'string' ? path.resolve(dir, manifest.hooks) : path.join(dir, 'hooks', 'hooks.json')
  const hooks = (await readJson(hooksFile)) as { modules?: unknown } | null
  if (!Array.isArray(hooks?.modules)) return []
  return hooks.modules
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => path.resolve(path.dirname(hooksFile), entry))
    .filter((file) => isInside(dir, file))
}

async function folderFromMarketplace(
  marketplace: { source?: { source?: string }; installLocation?: string } | undefined,
  pluginName: string,
): Promise<string | null> {
  if (marketplace?.source?.source !== 'directory' || !marketplace.installLocation) return null
  const root = marketplace.installLocation
  const listing = (await readJson(path.join(root, '.claude-plugin', 'marketplace.json'))) as
    | { plugins?: Array<{ name?: string; source?: unknown }> }
    | null
  const entry = listing?.plugins?.find((plugin) => plugin.name === pluginName)
  if (typeof entry?.source !== 'string') return null
  const dir = path.resolve(root, entry.source)
  return isInside(root, dir) && (await isDir(dir)) ? dir : null
}

async function readImages(dir: string, files: ModFile[], readme: string | null): Promise<ModImage[]> {
  // Images the README points at come first, in the order it shows them.
  const referenced = readme
    ? [...readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)|<img[^>]+src=["']([^"']+)["']/g)]
        .map((match) => path.normalize(decodeURI(match[1] ?? match[2])).replace(/^\.\//, ''))
    : []
  const images = files.filter((file) => isImage(file.relativePath) && file.sizeBytes <= MAX_IMAGE_BYTES)
  const rank = (file: ModFile) => {
    const index = referenced.indexOf(file.relativePath)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }
  images.sort((a, b) => rank(a) - rank(b) || a.relativePath.localeCompare(b.relativePath))

  return Promise.all(
    images.slice(0, MAX_IMAGES).map(async (file) => {
      const bytes = await fs.readFile(path.join(dir, file.relativePath))
      const type = IMAGE_TYPES[path.extname(file.relativePath).toLowerCase()]
      return { relativePath: file.relativePath, dataUrl: `data:${type};base64,${bytes.toString('base64')}` }
    }),
  )
}

async function readSources(dir: string, modulePaths: string[]): Promise<ModSource[]> {
  // The listed modules plus their sibling helpers, minus tests.
  const folders = [...new Set(modulePaths.map((file) => path.dirname(file)))]
  const found = new Set(modulePaths)
  for (const folder of folders) {
    for (const name of await fs.readdir(folder).catch(() => [])) {
      if (/\.(tsx?|jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) found.add(path.join(folder, name))
    }
  }
  const sources: ModSource[] = []
  for (const file of found) {
    const stat = await fs.stat(file).catch(() => null)
    if (!stat?.isFile() || stat.size > MAX_SOURCE_BYTES) continue
    sources.push({ relativePath: path.relative(dir, file), content: await fs.readFile(file, 'utf8') })
  }
  // Listed modules first, then helpers by name.
  const order = (source: ModSource) => modulePaths.indexOf(path.join(dir, source.relativePath))
  return sources.sort(
    (a, b) => (order(a) === -1 ? 1 : 0) - (order(b) === -1 ? 1 : 0) || a.relativePath.localeCompare(b.relativePath),
  )
}

async function listFiles(dir: string): Promise<ModFile[]> {
  const files: ModFile[] = []
  async function walk(current: string, prefix: string) {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue
      const relativePath = prefix ? path.join(prefix, entry.name) : entry.name
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(relativePath) && !SKIP_DIRS.has(entry.name)) await walk(absolute, relativePath)
      } else if (entry.isFile()) {
        const stat = await fs.stat(absolute).catch(() => null)
        files.push({ relativePath, sizeBytes: stat?.size ?? 0 })
      }
    }
  }
  await walk(dir, '')
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

async function readManifest(dir: string): Promise<Manifest | null> {
  return (await readJson(path.join(dir, '.claude-plugin', 'plugin.json'))) as Manifest | null
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return null
  }
}

async function subdirs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(dir, entry.name))
}

async function isDir(target: string): Promise<boolean> {
  return (await fs.stat(target).catch(() => null))?.isDirectory() ?? false
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function isImage(relativePath: string): boolean {
  return path.extname(relativePath).toLowerCase() in IMAGE_TYPES
}

function splitKey(key: string): [string, string] {
  const at = key.lastIndexOf('@')
  return at === -1 ? [key, ''] : [key.slice(0, at), key.slice(at + 1)]
}

function toScope(value: string | undefined): ModScope {
  return value === 'project' || value === 'local' ? value : 'user'
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
