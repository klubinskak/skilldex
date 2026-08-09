import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createConfigStore } from '../config'
import { defaultConfig } from '../types'

let dir: string
let filePath: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skilldex-config-'))
  filePath = path.join(dir, 'config.json')
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('ConfigStore', () => {
  it('returns defaults (favourites: []) when the file is missing', async () => {
    const config = await createConfigStore(filePath).load()
    expect(config).toEqual(defaultConfig)
    expect(config.favourites).toEqual([])
  })

  it('migrates an old config with no favourites field', async () => {
    await fs.writeFile(filePath, JSON.stringify({ includePersonal: true, includePlugins: true, projectRoots: [] }))
    const config = await createConfigStore(filePath).load()
    expect(config.favourites).toEqual([])
  })

  it('persists favourites and dedupes them', async () => {
    const store = createConfigStore(filePath)
    await store.save({ ...defaultConfig, favourites: ['/a/skill', '/a/skill', '/b/skill'] })
    const reloaded = await store.load()
    expect(reloaded.favourites).toEqual(['/a/skill', '/b/skill'])
  })

  it('writes atomically, leaving no temp file behind', async () => {
    await createConfigStore(filePath).save({ ...defaultConfig, favourites: ['/x'] })
    const leftovers = (await fs.readdir(dir)).filter((name) => name.includes('.tmp'))
    expect(leftovers).toEqual([])
    expect(JSON.parse(await fs.readFile(filePath, 'utf8')).favourites).toEqual(['/x'])
  })
})
