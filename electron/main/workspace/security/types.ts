/**
 * The static security-scan contract.
 *
 * A scan is a pure derivation from a skill's files: no I/O, no network. Findings
 * are only ever `red` or `amber` (a clean file produces none); the skill's
 * overall `verdict` is the max severity across its findings, with `green` meaning
 * nothing matched. These shapes cross the `window.skilldex` seam unchanged.
 */

/** A skill's overall trust colour. `green` = no findings. */
export type ScanVerdict = 'red' | 'amber' | 'green'

/** Findings carry a severity; there is no "green finding". */
export type FindingSeverity = 'red' | 'amber'

/** What kind of risk a finding represents (drives copy and grouping in the UI). */
export type FindingCategory =
  | 'pipe-to-shell'
  | 'credential-exfiltration'
  | 'obfuscated-execution'
  | 'network-access'
  | 'sensitive-path-read'
  | 'dynamic-eval'
  | 'destructive-fs'
  | 'prompt-injection'
  | 'suspicious-binary'

export type SkillFinding = {
  severity: FindingSeverity
  category: FindingCategory
  /** File within the skill dir, e.g. `SKILL.md` or `scripts/run.sh`. */
  file: string
  /** 1-based line the match sits on (0 for a whole-file finding like a binary). */
  line: number
  /** The matched text (the trimmed source line, truncated for display). */
  matchedText: string
  /** Plain-English reason this was flagged. */
  why: string
}

export type SkillScan = {
  verdict: ScanVerdict
  findings: SkillFinding[]
}

/**
 * A local skill's scan enriched with review state. `reviewed` is true when the
 * user has acknowledged *this exact content* as safe (keyed by a content hash),
 * so it clears itself automatically if any file later changes.
 */
export type SkillScanResult = SkillScan & {
  reviewed: boolean
}

/**
 * One file handed to the scanner. `contents` is the UTF-8 text, or `null` when
 * the file is binary/unreadable — kept separate from an empty string so a real
 * empty text file and a binary file are distinguishable.
 */
export type ScanFile = {
  /** Path relative to the skill directory, e.g. `SKILL.md` or `scripts/run.sh`. */
  relativePath: string
  contents: string | null
  sizeBytes: number
}
