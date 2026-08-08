import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../frontmatter'

describe('parseFrontmatter', () => {
  it('reads plain name and description', () => {
    const md = ['---', 'name: code-review', 'description: Review the diff.', '---', '', '# body'].join('\n')
    expect(parseFrontmatter(md)).toEqual({ name: 'code-review', description: 'Review the diff.' })
  })

  it('strips surrounding quotes and unescapes', () => {
    const md = ['---', 'name: "tdd"', 'description: "Say \\"red\\", green, refactor."', '---'].join('\n')
    expect(parseFrontmatter(md)).toEqual({ name: 'tdd', description: 'Say "red", green, refactor.' })
  })

  it('folds a block scalar into one line', () => {
    const md = ['---', 'name: research', 'description: >', '  Investigate against', '  primary sources.', '---'].join('\n')
    expect(parseFrontmatter(md).description).toBe('Investigate against primary sources.')
  })

  it('returns empty object when there is no frontmatter', () => {
    expect(parseFrontmatter('# just a heading')).toEqual({})
  })

  it('tolerates CRLF line endings and a BOM', () => {
    const md = '﻿---\r\nname: win\r\ndescription: ok\r\n---\r\n'
    expect(parseFrontmatter(md)).toEqual({ name: 'win', description: 'ok' })
  })
})
