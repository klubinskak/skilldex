/**
 * The I/O edge of the scanner: read a skill directory off disk into the pure
 * `scanSkillFiles` input, and derive a stable content hash of what was read.
 *
 * Kept apart from `scanner.ts` so the rule engine stays pure and fs-free. The
 * hash is what the workspace caches scans against and what "mark reviewed" keys
 * an acknowledgement to — change any file and the hash (and the review) moves.
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { listSkillFiles } from '../filesystem-source'
import { scanSkillFiles } from './scanner'
import type { ScanFile, SkillScan } from './types'

/** Files past this size are treated as opaque (hashed, but not scanned as text). */
const MAX_TEXT_BYTES = 2_000_000
/** How many leading bytes to sniff for a NUL when deciding text-vs-binary. */
const SNIFF_BYTES = 8000

/** Read every file under a skill dir as scanner input (binary files → null contents). */
export async function readScanFiles(skillDir: string): Promise<ScanFile[]> {
  const listed = await listSkillFiles(skillDir)
  const files = await Promise.all(
    listed.map(async (entry): Promise<ScanFile> => {
      const abs = path.join(skillDir, ...entry.relativePath.split('/'))
      const buffer = await fs.readFile(abs).catch(() => null)
      const contents =
        buffer && entry.sizeBytes <= MAX_TEXT_BYTES && !looksBinary(buffer)
          ? buffer.toString('utf8')
          : null
      return { relativePath: entry.relativePath, contents, sizeBytes: entry.sizeBytes }
    }),
  )
  return files
}

/** A NUL byte in the first few KB is the cheap, reliable "this is binary" signal. */
function looksBinary(buffer: Buffer): boolean {
  const end = Math.min(buffer.length, SNIFF_BYTES)
  for (let i = 0; i < end; i++) if (buffer[i] === 0) return true
  return false
}

/**
 * A content hash over the scanned files — order-independent (paths are sorted),
 * and covering path + size + text (or a `<binary>` marker). Two skills with
 * identical bytes hash the same; touching any file changes it.
 */
export function hashScanFiles(files: ScanFile[]): string {
  const hash = createHash('sha256')
  for (const file of [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
    hash.update(file.relativePath)
    hash.update('\0')
    hash.update(String(file.sizeBytes))
    hash.update('\0')
    hash.update(file.contents ?? '<binary>')
    hash.update('\0')
  }
  return hash.digest('hex')
}

/** Read, hash, and scan a skill directory in one pass. */
export async function scanSkillDir(skillDir: string): Promise<{ scan: SkillScan; contentHash: string }> {
  const files = await readScanFiles(skillDir)
  return { scan: scanSkillFiles(files), contentHash: hashScanFiles(files) }
}
