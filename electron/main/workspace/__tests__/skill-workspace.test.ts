import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createConfigStore } from '../config'
import { createSkillWorkspace, type SkillWorkspace } from '../skill-workspace'

let home: string
let workspaceRoot: string
let workspace: SkillWorkspace

async function writeSkill(dir: string, name: string, description: string) {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`)
}

beforeEach(async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'skilldex-'))
  home = path.join(base, 'home')
  workspaceRoot = path.join(base, 'code')

  // Personal skills
  await writeSkill(path.join(home, '.claude', 'skills', 'alpha'), 'alpha', 'First personal skill.')
  await writeSkill(path.join(home, '.claude', 'skills', 'beta'), 'beta', 'Second personal skill.')

  // A personal skill that a project will symlink to (dedupe target)
  const sharedReal = path.join(home, '.agents', 'skills', 'shared')
  await writeSkill(sharedReal, 'shared', 'Shared skill.')
  await fs.symlink(sharedReal, path.join(home, '.claude', 'skills', 'shared'))

  // Plugin skill
  await writeSkill(
    path.join(home, '.claude', 'plugins', 'marketplaces', 'mkt', 'plugins', 'p1', 'skills', 'gamma'),
    'gamma',
    'A plugin skill.',
  )

  // Project skills under a workspace directory
  await writeSkill(path.join(workspaceRoot, 'proj1', '.claude', 'skills', 'delta'), 'delta', 'Project skill.')
  // proj1 also references the shared personal skill via symlink
  await fs.symlink(sharedReal, path.join(workspaceRoot, 'proj1', '.claude', 'skills', 'shared'))

  const configStore = createConfigStore(path.join(base, 'config.json'))
  workspace = createSkillWorkspace({ homeDir: home, configStore })
})

afterEach(async () => {
  await fs.rm(path.dirname(home), { recursive: true, force: true })
})

describe('SkillWorkspace', () => {
  it('discovers personal and plugin skills by default', async () => {
    const snapshot = await workspace.getSnapshot()
    const names = snapshot.skills.map((skill) => skill.name)
    expect(names).toContain('alpha')
    expect(names).toContain('beta')
    expect(names).toContain('gamma')
    expect(snapshot.skills.find((s) => s.name === 'gamma')?.sourceKind).toBe('Plugin')
  })

  it('tildifies source roots for display', async () => {
    const snapshot = await workspace.getSnapshot()
    expect(snapshot.skills.find((s) => s.name === 'alpha')?.sourceRoot).toBe('~/.claude/skills')
  })

  it('includes project skills and records the project when configured', async () => {
    const snapshot = await workspace.configureSources({
      includePersonal: true,
      includePlugins: true,
      projectRoots: [workspaceRoot],
    })
    expect(snapshot.projects.map((p) => p.name)).toContain('proj1')
    expect(snapshot.skills.find((s) => s.name === 'delta')?.sourceKind).toBe('Project')
  })

  it('dedupes a skill surfaced via symlink and merges its projects', async () => {
    const snapshot = await workspace.configureSources({
      includePersonal: true,
      includePlugins: false,
      projectRoots: [workspaceRoot],
    })
    const shared = snapshot.skills.filter((s) => s.name === 'shared')
    expect(shared).toHaveLength(1)
    expect(shared[0].projects).toContain('proj1')
    expect(shared[0].isSymlink).toBe(true)
  })

  it('persists configuration across workspace reads', async () => {
    await workspace.configureSources({ includePersonal: false, includePlugins: false, projectRoots: [workspaceRoot] })
    const snapshot = await workspace.getSnapshot()
    expect(snapshot.skills.every((s) => s.sourceKind === 'Project')).toBe(true)
  })

  it('reports a file count for discovered skills', async () => {
    const snapshot = await workspace.getSnapshot()
    expect(snapshot.skills.find((s) => s.name === 'alpha')?.fileCount).toBeGreaterThanOrEqual(1)
  })

  it('returns SKILL.md content only for a known skill id', async () => {
    const snapshot = await workspace.getSnapshot()
    const alpha = snapshot.skills.find((s) => s.name === 'alpha')!
    expect(await workspace.getSkillReadme(alpha.id)).toContain('First personal skill.')
    expect(await workspace.getSkillReadme('/etc/passwd')).toBeNull()
  })

  it('lists a known skill files and resolves its path, rejecting unknown ids', async () => {
    const snapshot = await workspace.getSnapshot()
    const alpha = snapshot.skills.find((s) => s.name === 'alpha')!
    const files = await workspace.listSkillFiles(alpha.id)
    expect(files?.map((f) => f.relativePath)).toContain('SKILL.md')
    expect(await workspace.resolveSkillPath(alpha.id)).toMatch(/alpha\/SKILL\.md$/)
    expect(await workspace.resolveSkillPath('/etc/passwd')).toBeNull()
  })

  describe('management', () => {
    it('disables then re-enables a personal skill', async () => {
      const before = await workspace.getSnapshot()
      const alpha = before.skills.find((s) => s.name === 'alpha')!

      const disabled = await workspace.disableSkill(alpha.id)
      const off = disabled.skills.find((s) => s.name === 'alpha')!
      expect(off.enabled).toBe(false)

      const enabled = await workspace.enableSkill(off.id)
      expect(enabled.skills.find((s) => s.name === 'alpha')!.enabled).toBe(true)
    })

    it('removes a personal skill from disk', async () => {
      const before = await workspace.getSnapshot()
      const beta = before.skills.find((s) => s.name === 'beta')!
      const after = await workspace.removeSkill(beta.id)
      expect(after.skills.find((s) => s.name === 'beta')).toBeUndefined()
    })

    it('refuses to manage plugin skills', async () => {
      const snapshot = await workspace.getSnapshot()
      const gamma = snapshot.skills.find((s) => s.name === 'gamma')!
      await expect(workspace.disableSkill(gamma.id)).rejects.toThrow(/plugin/i)
      await expect(workspace.removeSkill(gamma.id)).rejects.toThrow(/plugin/i)
    })

    it('creates a global skill', async () => {
      const after = await workspace.createSkill({ name: 'New Thing', description: 'does stuff', scope: 'global' })
      const created = after.skills.find((s) => s.name === 'new-thing')
      expect(created?.sourceKind).toBe('Personal')
    })

    it('creates a project skill in the named project', async () => {
      await workspace.configureSources({ includePersonal: false, includePlugins: false, projectRoots: [workspaceRoot] })
      const after = await workspace.createSkill({
        name: 'Proj Skill',
        description: 'scoped',
        scope: 'project',
        projectName: 'proj1',
      })
      const created = after.skills.find((s) => s.name === 'proj-skill')
      expect(created?.sourceKind).toBe('Project')
      expect(created?.projects).toContain('proj1')
    })

    it('rejects a duplicate skill name', async () => {
      await workspace.createSkill({ name: 'dupe', description: '', scope: 'global' })
      await expect(workspace.createSkill({ name: 'dupe', description: '', scope: 'global' })).rejects.toThrow(/exists/i)
    })
  })
})
