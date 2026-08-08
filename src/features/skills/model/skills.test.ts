import { describe, expect, it } from 'vitest'
import { monoFor, scopeFor, tildify } from './skills'

describe('tildify', () => {
  it('replaces a leading home directory with ~', () => {
    expect(tildify('/Users/alex/.claude/skills/x', '/Users/alex')).toBe('~/.claude/skills/x')
  })

  it('returns ~ for the home directory itself', () => {
    expect(tildify('/Users/alex', '/Users/alex')).toBe('~')
  })

  it('leaves unrelated paths and an empty home unchanged', () => {
    expect(tildify('/opt/thing', '/Users/alex')).toBe('/opt/thing')
    expect(tildify('/Users/alex/x', '')).toBe('/Users/alex/x')
  })

  it('does not match a sibling directory that shares a prefix', () => {
    expect(tildify('/Users/alexander/x', '/Users/alex')).toBe('/Users/alexander/x')
  })
})

describe('monoFor', () => {
  it('takes initials of the first two words', () => {
    expect(monoFor('pdf-form-filler')).toBe('PF')
  })

  it('falls back to the first two letters for a single word', () => {
    expect(monoFor('research')).toBe('RE')
  })
})

describe('scopeFor', () => {
  it('maps source kinds to display scopes', () => {
    expect(scopeFor('Personal')).toBe('global')
    expect(scopeFor('Plugin')).toBe('plugin')
    expect(scopeFor('Project')).toBe('project')
  })
})
