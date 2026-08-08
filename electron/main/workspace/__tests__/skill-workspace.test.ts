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
})
