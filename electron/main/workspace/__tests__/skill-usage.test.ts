import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { scanSkillUsage } from '../skill-usage'

let root: string

function assistantLine(overrides: {
  skill?: string
  timestamp?: string
  cwd?: string
  isSidechain?: boolean
}): string {
  const { skill, timestamp = '2026-01-01T00:00:00.000Z', cwd = '/Users/x/project', isSidechain = false } = overrides
  const content = skill
    ? [{ type: 'tool_use', id: 'toolu_1', name: 'Skill', input: { skill, args: 'do it' } }]
    : [{ type: 'text', text: 'no skill here' }]
  return JSON.stringify({
    type: 'assistant',
    isSidechain,
    timestamp,
    cwd,
    sessionId: 'sess-1',
    message: { role: 'assistant', content },
  })
}

async function writeTranscript(project: string, session: string, lines: string[]) {
  const dir = path.join(root, '.claude', 'projects', project)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, `${session}.jsonl`), lines.join('\n') + '\n', 'utf8')
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'skilldex-usage-'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('scanSkillUsage', () => {
  it('returns an empty map when there are no transcripts', async () => {
    expect(await scanSkillUsage(root)).toEqual({})
  })

  it('counts a Skill tool_use and records its timestamp and cwd', async () => {
    await writeTranscript('-Users-x-project', 'sess-1', [
      assistantLine({ skill: 'brainstorming', timestamp: '2026-01-01T00:00:00.000Z', cwd: '/Users/x/project' }),
    ])

    const usage = await scanSkillUsage(root)
    expect(usage.brainstorming.count).toBe(1)
    expect(usage.brainstorming.lastUsedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(usage.brainstorming.recent).toEqual([{ timestamp: '2026-01-01T00:00:00.000Z', cwd: '/Users/x/project' }])
  })

  it('aggregates invocations across multiple sessions and projects, keeping lastUsedAt current', async () => {
    await writeTranscript('-Users-x-project-a', 'sess-1', [
      assistantLine({ skill: 'deploy', timestamp: '2026-01-01T00:00:00.000Z', cwd: '/Users/x/project-a' }),
    ])
    await writeTranscript('-Users-x-project-b', 'sess-2', [
      assistantLine({ skill: 'deploy', timestamp: '2026-02-01T00:00:00.000Z', cwd: '/Users/x/project-b' }),
    ])

    const usage = await scanSkillUsage(root)
    expect(usage.deploy.count).toBe(2)
    expect(usage.deploy.lastUsedAt).toBe('2026-02-01T00:00:00.000Z')
  })

  it('ignores assistant messages with no Skill tool_use', async () => {
    await writeTranscript('-Users-x-project', 'sess-1', [assistantLine({})])
    expect(await scanSkillUsage(root)).toEqual({})
  })

  it('ignores malformed lines instead of throwing', async () => {
    await writeTranscript('-Users-x-project', 'sess-1', [
      'not json at all',
      assistantLine({ skill: 'tdd', timestamp: '2026-01-01T00:00:00.000Z' }),
    ])
    const usage = await scanSkillUsage(root)
    expect(usage.tdd.count).toBe(1)
  })

  it('caps recent events and sorts them newest first', async () => {
    const lines = Array.from({ length: 25 }, (_, i) =>
      assistantLine({ skill: 'busy', timestamp: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` }),
    )
    await writeTranscript('-Users-x-project', 'sess-1', lines)

    const usage = await scanSkillUsage(root)
    expect(usage.busy.count).toBe(25)
    expect(usage.busy.recent).toHaveLength(20)
    expect(usage.busy.recent[0].timestamp).toBe('2026-01-25T00:00:00.000Z')
  })

  it('returns an empty map when the projects directory does not exist', async () => {
    const usage = await scanSkillUsage(path.join(root, 'nonexistent-home'))
    expect(usage).toEqual({})
  })
})
