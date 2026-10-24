import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createModCatalog, hooksModules, writeEnabled } from '../mod-catalog'

let home: string

async function write(file: string, content: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2))
}

async function readJson(file: string) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function makeMod(dir: string, name: string, source = `on('session.start', ($, e, next) => next(e))`) {
  await write(path.join(dir, '.claude-plugin', 'plugin.json'), { name, version: '0.1.0', description: `${name} mod` })
  await write(path.join(dir, 'hooks', 'hooks.json'), { modules: ['./register.tsx'] })
  await write(path.join(dir, 'hooks', 'register.tsx'), source)
}

const settingsFile = () => path.join(home, '.claude', 'settings.json')

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'skilldex-mods-'))
  const mods = path.join(home, 'claude-mods')
  await makeMod(path.join(mods, 'mods', 'repo-bar'), 'repo-bar', `on('ui.render', { component: 'AbovePrompt' }, h)`)
  await write(path.join(mods, '.claude-plugin', 'marketplace.json'), {
    name: 'my-mods',
    plugins: [{ name: 'repo-bar', source: './mods/repo-bar' }],
  })
  // A plain plugin (classic hooks, no modules) is not a mod.
  const plain = path.join(home, '.claude', 'plugins', 'cache', 'other', 'plain', '1.0.0')
  await write(path.join(plain, '.claude-plugin', 'plugin.json'), { name: 'plain' })
  await write(path.join(plain, 'hooks', 'hooks.json'), { hooks: {} })

  await write(path.join(home, '.claude', 'plugins', 'known_marketplaces.json'), {
    'my-mods': { source: { source: 'directory', path: mods }, installLocation: mods },
  })
  await write(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
    version: 2,
    plugins: {
      'repo-bar@my-mods': [
        { scope: 'user', installPath: path.join(home, '.claude', 'plugins', 'cache', 'my-mods', 'repo-bar', '0.1.0'), version: '0.1.0' },
      ],
      'plain@other': [{ scope: 'user', installPath: plain, version: '1.0.0' }],
    },
  })
  await write(settingsFile(), { model: 'opus', enabledPlugins: { 'repo-bar@my-mods': true, 'plain@other': true } })
})

afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true })
})

describe('createModCatalog', () => {
  it('lists installed mods from their marketplace folder and skips plain plugins', async () => {
    const { mods, errors } = await createModCatalog({ homeDir: home }).list()
    expect(errors).toEqual([])
    expect(mods).toHaveLength(1)
    expect(mods[0]).toMatchObject({
      id: 'repo-bar@my-mods',
      name: 'repo-bar',
      marketplace: 'my-mods',
      kind: 'installed',
      scope: 'user',
      enabled: true,
      canToggle: true,
      readFrom: 'folder',
      displayPath: '~/claude-mods/mods/repo-bar',
    })
    expect(mods[0].anatomy.surfaces).toEqual(['band'])
  })

  it('switches a mod off and on without touching other settings', async () => {
    const catalog = createModCatalog({ homeDir: home })
    const off = await catalog.setEnabled('repo-bar@my-mods', false)
    expect(off.mods[0].enabled).toBe(false)
    expect(await readJson(settingsFile())).toEqual({
      model: 'opus',
      enabledPlugins: { 'repo-bar@my-mods': false, 'plain@other': true },
    })
    const on = await catalog.setEnabled('repo-bar@my-mods', true)
    expect(on.mods[0].enabled).toBe(true)
  })

  it('lists session drafts read-only and refuses to toggle them', async () => {
    const draft = path.join(home, '.claude', 'dev-mods', 'session-1', 'md-preview')
    await makeMod(draft, 'md-preview', `await $.ui.open({ id: 'p', title: 'Preview' })`)
    // Engine-written typings are not part of the mod.
    await write(path.join(draft, '.claude-plugin', 'types', 'claude-code', 'index.d.ts'), 'declare module "x" {}')

    const catalog = createModCatalog({ homeDir: home })
    const { mods } = await catalog.list()
    const found = mods.find((mod) => mod.kind === 'draft')
    expect(found).toMatchObject({ name: 'md-preview', scope: 'session', canToggle: false })
    await expect(catalog.setEnabled(found!.id, true)).rejects.toThrow(/session/)

    const detail = await catalog.getDetail(found!.id)
    expect(detail?.files.map((file) => file.relativePath)).not.toContain(
      path.join('.claude-plugin', 'types', 'claude-code', 'index.d.ts'),
    )
  })

  it('returns the README, images (README order first) and hooks sources', async () => {
    const dir = path.join(home, 'claude-mods', 'mods', 'repo-bar')
    await write(path.join(dir, 'README.md'), '# repo-bar\n\n![band](screenshots/b.png)\n')
    await write(path.join(dir, 'screenshots', 'a.png'), 'png-a')
    await write(path.join(dir, 'screenshots', 'b.png'), 'png-b')
    await write(path.join(dir, 'hooks', 'parse.ts'), 'export const x = 1')
    await write(path.join(dir, 'hooks', 'parse.test.ts'), 'test')

    const detail = await createModCatalog({ homeDir: home }).getDetail('repo-bar@my-mods')
    expect(detail?.readme).toContain('# repo-bar')
    expect(detail?.images.map((image) => image.relativePath)).toEqual([
      path.join('screenshots', 'b.png'),
      path.join('screenshots', 'a.png'),
    ])
    expect(detail?.images[0].dataUrl).toBe(`data:image/png;base64,${Buffer.from('png-b').toString('base64')}`)
    expect(detail?.sources.map((source) => source.relativePath)).toEqual([
      path.join('hooks', 'register.tsx'),
      path.join('hooks', 'parse.ts'),
    ])
  })

  it('returns null detail for an unknown id', async () => {
    expect(await createModCatalog({ homeDir: home }).getDetail('nope@nowhere')).toBeNull()
  })
})

describe('writeEnabled', () => {
  it('creates the settings file when there is none', async () => {
    const file = path.join(home, 'project', '.claude', 'settings.local.json')
    await writeEnabled(file, 'x@y', false)
    expect(await readJson(file)).toEqual({ enabledPlugins: { 'x@y': false } })
  })

  it('refuses to overwrite a settings file it cannot parse', async () => {
    await write(settingsFile(), '{ broken')
    await expect(writeEnabled(settingsFile(), 'x@y', true)).rejects.toThrow(/Could not read/)
    expect(await fs.readFile(settingsFile(), 'utf8')).toBe('{ broken')
  })
})

describe('hooksModules', () => {
  it('ignores module paths that point outside the mod', async () => {
    const dir = path.join(home, 'evil')
    await write(path.join(dir, 'hooks', 'hooks.json'), { modules: ['../../outside.ts', './ok.ts'] })
    expect(await hooksModules(dir)).toEqual([path.join(dir, 'hooks', 'ok.ts')])
  })
})
