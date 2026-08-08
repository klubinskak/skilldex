import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DISABLED_DIR,
  disableSkillDir,
  enableSkillDir,
  removeSkillDir,
  scaffoldSkill,
  slugify,
} from '../skill-manager'

let root: string

async function makeSkill(dir: string) {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'SKILL.md'), '---\nname: x\ndescription: y\n---\n')
}

async function exists(target: string): Promise<boolean> {
  return fs.access(target).then(() => true).catch(() => false)
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'skilldex-mgr-'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('slugify', () => {
  it('turns a display name into a safe slug', () => {
    expect(slugify('PDF Form Filler')).toBe('pdf-form-filler')
    expect(slugify('  Weird__Name!! ')).toBe('weird-name')
    expect(slugify('***')).toBe('skill')
  })
})

describe('disable/enable', () => {
  it('moves a skill into .disabled and back', async () => {
    const skill = path.join(root, 'alpha')
    await makeSkill(skill)

    const disabled = await disableSkillDir(skill)
    expect(disabled).toBe(path.join(root, DISABLED_DIR, 'alpha'))
    expect(await exists(skill)).toBe(false)
    expect(await exists(path.join(disabled, 'SKILL.md'))).toBe(true)

    const enabled = await enableSkillDir(disabled)
    expect(enabled).toBe(skill)
    expect(await exists(path.join(skill, 'SKILL.md'))).toBe(true)
  })
})

describe('removeSkillDir', () => {
  it('deletes a real directory', async () => {
    const skill = path.join(root, 'beta')
    await makeSkill(skill)
    await removeSkillDir(skill)
    expect(await exists(skill)).toBe(false)
  })

  it('unlinks a symlink without touching its target', async () => {
    const target = path.join(root, 'real')
    await makeSkill(target)
    const link = path.join(root, 'link')
    await fs.symlink(target, link)

    await removeSkillDir(link)
    expect(await exists(link)).toBe(false)
    expect(await exists(path.join(target, 'SKILL.md'))).toBe(true)
  })
})

describe('scaffoldSkill', () => {
  it('creates a slugged folder with SKILL.md frontmatter', async () => {
    const dir = await scaffoldSkill(root, 'My New Skill', 'Does a thing')
    expect(dir).toBe(path.join(root, 'my-new-skill'))
    const md = await fs.readFile(path.join(dir, 'SKILL.md'), 'utf8')
    expect(md).toContain('name: my-new-skill')
    expect(md).toContain('Does a thing')
  })

  it('refuses to overwrite an existing skill', async () => {
    await scaffoldSkill(root, 'dupe', 'first')
    await expect(scaffoldSkill(root, 'dupe', 'second')).rejects.toThrow(/exists/i)
  })
})
