/**
 * The skill security scanner — a pure function over a skill's files.
 *
 * No I/O and no network: the caller reads the files, this decides the verdict.
 * That keeps it deterministic and unit-testable, and keeps the "never sends your
 * data anywhere" promise intact (see the issue's engine decision).
 *
 * Pipeline: run the line rules over every text file, flag executable binaries,
 * correlate a sensitive-path read with a network call into a single red
 * credential-exfiltration finding, then collapse noise (drop an amber finding on
 * a line that already carries a red one) and rank the results.
 */

import { isSuspiciousBinary, LINE_RULES, roleOf } from './rules'
import type { FindingSeverity, ScanFile, SkillFinding, SkillScan, ScanVerdict } from './types'

const MAX_MATCH_LEN = 200
const SEVERITY_RANK: Record<FindingSeverity, number> = { red: 2, amber: 1 }

export function scanSkillFiles(files: ScanFile[]): SkillScan {
  const findings: SkillFinding[] = []

  for (const file of files) {
    if (file.contents === null) {
      if (isSuspiciousBinary(file.relativePath)) {
        findings.push({
          severity: 'amber',
          category: 'suspicious-binary',
          file: file.relativePath,
          line: 0,
          matchedText: file.relativePath,
          why: 'An executable binary is shipped inside the skill — its behaviour cannot be inspected.',
        })
      }
      continue
    }

    const role = roleOf(file.relativePath)
    const lines = file.contents.split(/\r?\n/)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const rule of LINE_RULES) {
        if (rule.appliesTo === 'doc' && role !== 'doc') continue
        if (!rule.pattern.test(line)) continue
        findings.push({
          severity: rule.severity,
          category: rule.category,
          file: file.relativePath,
          line: i + 1,
          matchedText: truncate(line.trim()),
          why: rule.why,
        })
      }
    }
  }

  correlateExfiltration(findings)
  const ranked = rank(dropSubsumedAmber(findings))
  return { verdict: verdictFor(ranked), findings: ranked }
}

/**
 * A sensitive-path read on its own is amber and a network call on its own is
 * amber — but a skill that does *both* is the credential-exfiltration shape the
 * research warns about, even when the two live on different lines or in
 * different files. Synthesize one red finding anchored at the sensitive read.
 */
function correlateExfiltration(findings: SkillFinding[]): void {
  const secret = findings.find((f) => f.category === 'sensitive-path-read')
  const network = findings.some((f) => f.category === 'network-access')
  if (!secret || !network) return
  if (findings.some((f) => f.category === 'credential-exfiltration')) return
  findings.push({
    severity: 'red',
    category: 'credential-exfiltration',
    file: secret.file,
    line: secret.line,
    matchedText: secret.matchedText,
    why: 'Reads a sensitive credentials path and the skill also makes network calls — together, a possible credential-exfiltration path.',
  })
}

/** When a line already has a red finding, its amber findings are just noise. */
function dropSubsumedAmber(findings: SkillFinding[]): SkillFinding[] {
  const redLines = new Set(
    findings.filter((f) => f.severity === 'red').map((f) => `${f.file}:${f.line}`),
  )
  return findings.filter(
    (f) => f.severity === 'red' || !redLines.has(`${f.file}:${f.line}`),
  )
}

/** Reds first, then by file then line — a stable order for the findings panel. */
function rank(findings: SkillFinding[]): SkillFinding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  )
}

function verdictFor(findings: SkillFinding[]): ScanVerdict {
  if (findings.some((f) => f.severity === 'red')) return 'red'
  if (findings.some((f) => f.severity === 'amber')) return 'amber'
  return 'green'
}

function truncate(text: string): string {
  return text.length > MAX_MATCH_LEN ? `${text.slice(0, MAX_MATCH_LEN)}…` : text
}
