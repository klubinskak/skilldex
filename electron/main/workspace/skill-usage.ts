/**
 * Actual skill-usage tracking, derived from Claude Code's own session
 * transcripts — no hook or config change required.
 *
 * Every Claude Code session writes a JSONL transcript to
 * `~/.claude/projects/<project>/<session-id>.jsonl`. Each time a skill is
 * invoked, the assistant message that triggered it carries a `tool_use` block
 * named `Skill` with the skill's name in `input.skill`. We stream every
 * transcript once, matching only by skill name — the transcript has no
 * resolved path, so two installed skills sharing a name are counted together.
 */

import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import type { SkillUsage, SkillUsageEvent } from './types'

const RECENT_LIMIT = 20

export async function scanSkillUsage(homeDir: string): Promise<Record<string, SkillUsage>> {
  const projectsDir = path.join(homeDir, '.claude', 'projects')

  let projectDirs: string[]
  try {
    projectDirs = await fs.readdir(projectsDir)
  } catch {
    return {}
  }

  const files = (
    await Promise.all(
      projectDirs.map(async (dir) => {
        const full = path.join(projectsDir, dir)
        try {
          const entries = await fs.readdir(full)
          return entries.filter((entry) => entry.endsWith('.jsonl')).map((entry) => path.join(full, entry))
        } catch {
          return []
        }
      }),
    )
  ).flat()

  const usage: Record<string, SkillUsage> = {}
  await Promise.all(files.map((file) => scanTranscript(file, usage)))

  for (const record of Object.values(usage)) {
    record.recent.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    record.recent.length = Math.min(record.recent.length, RECENT_LIMIT)
  }

  return usage
}

async function scanTranscript(filePath: string, usage: Record<string, SkillUsage>): Promise<void> {
  const rl = readline.createInterface({ input: createReadStream(filePath, 'utf8'), crlfDelay: Infinity })
  for await (const line of rl) {
    // Cheap pre-filter: skip JSON.parse on the (large majority of) lines that
    // can't possibly contain a Skill invocation.
    if (!line.includes('"Skill"')) continue
    for (const event of extractSkillEvents(line)) {
      const record = (usage[event.skill] ??= { count: 0, lastUsedAt: event.timestamp, recent: [] })
      record.count += 1
      if (event.timestamp > record.lastUsedAt) record.lastUsedAt = event.timestamp
      record.recent.push({ timestamp: event.timestamp, cwd: event.cwd })
    }
  }
}

function extractSkillEvents(line: string): Array<SkillUsageEvent & { skill: string }> {
  let entry: unknown
  try {
    entry = JSON.parse(line)
  } catch {
    return []
  }
  if (typeof entry !== 'object' || entry === null) return []
  const record = entry as Record<string, unknown>
  if (record.type !== 'assistant') return []

  const message = record.message as Record<string, unknown> | undefined
  const content = message?.content
  if (!Array.isArray(content)) return []

  const timestamp = typeof record.timestamp === 'string' ? record.timestamp : new Date(0).toISOString()
  const cwd = typeof record.cwd === 'string' ? record.cwd : ''

  const events: Array<SkillUsageEvent & { skill: string }> = []
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue
    const toolUse = block as Record<string, unknown>
    if (toolUse.type !== 'tool_use' || toolUse.name !== 'Skill') continue
    const input = toolUse.input as Record<string, unknown> | undefined
    const skill = typeof input?.skill === 'string' ? input.skill : null
    if (skill) events.push({ skill, timestamp, cwd })
  }
  return events
}
