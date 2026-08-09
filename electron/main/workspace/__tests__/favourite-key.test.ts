import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { favouriteKeyFor } from '../favourite-key'
import { DISABLED_DIR } from '../skill-manager'

describe('favouriteKeyFor', () => {
  it('leaves an enabled skill path unchanged', () => {
    const p = path.join('/home', '.claude', 'skills', 'tdd')
    expect(favouriteKeyFor(p)).toBe(p)
  })

  it('collapses the .disabled/ parent so enabled and disabled share a key', () => {
    const enabled = path.join('/home', '.claude', 'skills', 'tdd')
    const disabled = path.join('/home', '.claude', 'skills', DISABLED_DIR, 'tdd')
    expect(favouriteKeyFor(disabled)).toBe(enabled)
    expect(favouriteKeyFor(disabled)).toBe(favouriteKeyFor(enabled))
  })

  it('only collapses the .disabled that parents the skill dir', () => {
    // A coincidental `.disabled` higher in the tree must be preserved.
    const p = path.join('/home', DISABLED_DIR, 'skills', 'tdd')
    expect(favouriteKeyFor(p)).toBe(p)
  })
})
