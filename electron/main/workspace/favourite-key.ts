/**
 * A skill's identity for favouriting.
 *
 * A skill's `id` is its canonical real path, but disabling a skill physically
 * moves its directory into a `.disabled/` sibling (see skill-manager.ts), which
 * changes that path. Keying favourites on the raw path would therefore drop the
 * favourite the moment a skill is switched off. Normalizing the path — stripping
 * a single `.disabled/` segment — gives one stable key across enable/disable so
 * the favourite (the "filled heart") sticks.
 */

import path from 'node:path'
import { DISABLED_DIR } from './skill-manager'

/** Stable favourite key for a skill's real path, independent of enabled state. */
export function favouriteKeyFor(realPath: string): string {
  const dir = path.dirname(realPath)
  // Only collapse the `.disabled/` that parents the skill dir — the one the
  // disable move inserts — not a coincidental `.disabled` higher in the tree.
  if (path.basename(dir) !== DISABLED_DIR) return realPath
  return path.join(path.dirname(dir), path.basename(realPath))
}
