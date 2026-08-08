/**
 * Filesystem write operations for skill management. Internal to SkillWorkspace
 * — the workspace validates ids/paths against its known-skills allow-list before
 * calling these, so nothing here is exposed directly across the seam.
 *
 * Disabling moves a skill into a `.disabled/` sibling of its skills root instead
 * of deleting it, so it stays reversible and simply reads back as `enabled:false`.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

export const DISABLED_DIR = '.disabled'

/** Turn a display name into a safe directory slug. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill'
  )
}

/** Is this skill directory currently under a `.disabled/` folder? */
export function isDisabledPath(skillDir: string): boolean {
  return path.basename(path.dirname(skillDir)) === DISABLED_DIR
}

/** Move `<root>/<name>` → `<root>/.disabled/<name>`. Returns the new path. */
export async function disableSkillDir(skillDir: string): Promise<string> {
  const root = path.dirname(skillDir)
  const name = path.basename(skillDir)
  const disabledRoot = path.join(root, DISABLED_DIR)
  const dest = path.join(disabledRoot, name)
  await fs.mkdir(disabledRoot, { recursive: true })
  await assertMissing(dest)
  await fs.rename(skillDir, dest)
  return dest
}

/** Move `<root>/.disabled/<name>` → `<root>/<name>`. Returns the new path. */
export async function enableSkillDir(skillDir: string): Promise<string> {
  const root = path.dirname(path.dirname(skillDir))
  const name = path.basename(skillDir)
  const dest = path.join(root, name)
  await assertMissing(dest)
  await fs.rename(skillDir, dest)
  return dest
}

/** Delete a skill directory (or unlink it if it is a symlink). */
export async function removeSkillDir(skillDir: string): Promise<void> {
  const info = await fs.lstat(skillDir)
  if (info.isSymbolicLink()) {
    await fs.unlink(skillDir)
  } else {
    await fs.rm(skillDir, { recursive: true, force: true })
  }
}

/** Scaffold `<root>/<slug>/SKILL.md` with frontmatter. Returns the created dir. */
export async function scaffoldSkill(root: string, name: string, description: string): Promise<string> {
  const slug = slugify(name)
  const dir = path.join(root, slug)
  await assertMissing(dir, `A skill named "${slug}" already exists.`)
  await fs.mkdir(dir, { recursive: true })
  const body = `---\nname: ${slug}\ndescription: ${JSON.stringify(description || name)}\n---\n\n# ${name}\n\n${description}\n`
  await fs.writeFile(path.join(dir, 'SKILL.md'), body, 'utf8')
  return dir
}

async function assertMissing(target: string, message?: string): Promise<void> {
  try {
    await fs.access(target)
  } catch {
    return
  }
  throw new Error(message ?? `Path already exists: ${target}`)
}
