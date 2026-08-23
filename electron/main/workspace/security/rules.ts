/**
 * The v1 heuristic rule set for the skill security scanner.
 *
 * Every rule is a single-line regex plus its severity, category, and a
 * plain-English `why`. Rules are deterministic and intentionally conservative:
 * `red` is reserved for patterns that are almost never benign (piping remote
 * content into a shell, decoding-then-executing a payload, or reading a secret
 * straight into a network sink); `amber` covers "legitimate but worth a look"
 * (a bare network call, a sensitive-path read, `eval`, `rm -rf`).
 *
 * `appliesTo` limits a rule to a file role: `'all'` text files, or `'doc'`
 * (markdown) only. Shell/network rules run on every text file — including code
 * fenced inside a SKILL.md, which is exactly the dynamic-context execution risk.
 */

import type { FindingCategory, FindingSeverity } from './types'

export type FileRole = 'doc' | 'script' | 'other'

export type LineRule = {
  category: FindingCategory
  severity: FindingSeverity
  pattern: RegExp
  why: string
  appliesTo: 'all' | 'doc'
}

/** Markdown files are docs; known script extensions are scripts; the rest are `other`. */
export function roleOf(relativePath: string): FileRole {
  const lower = relativePath.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'doc'
  if (/\.(sh|bash|zsh|fish|py|js|mjs|cjs|ts|rb|pl|ps1|php|lua)$/.test(lower)) return 'script'
  return 'other'
}

/** Executable-looking binaries that have no business shipping inside a skill. */
const EXECUTABLE_BINARY = /\.(exe|dll|so|dylib|bin|o|a|out|com|msi|scr|app|deb|rpm)$/i

/** True when a binary file should be flagged (executable extension). */
export function isSuspiciousBinary(relativePath: string): boolean {
  return EXECUTABLE_BINARY.test(relativePath)
}

export const LINE_RULES: LineRule[] = [
  // ---- red: pipe remote content straight into an interpreter ----
  {
    category: 'pipe-to-shell',
    severity: 'red',
    pattern:
      /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash|python[0-9.]*|perl|ruby|node)\b/i,
    why: 'Downloads a remote script and pipes it straight into a shell — the classic supply-chain execution pattern.',
    appliesTo: 'all',
  },
  {
    category: 'pipe-to-shell',
    severity: 'red',
    pattern: /\b(?:iwr|irm|invoke-webrequest|invoke-restmethod)\b[^\n|]*\|\s*iex\b/i,
    why: 'PowerShell downloads remote content and runs it with Invoke-Expression.',
    appliesTo: 'all',
  },

  // ---- red: decode-then-execute an obfuscated payload ----
  {
    category: 'obfuscated-execution',
    severity: 'red',
    pattern: /\bbase64\s+(?:-d|-D|--decode)\b[^\n|]*\|\s*(?:sh|bash|zsh|python[0-9.]*|perl|ruby|node)\b/i,
    why: 'Decodes a base64 blob and executes it, hiding the real command from a reader.',
    appliesTo: 'all',
  },
  {
    category: 'obfuscated-execution',
    severity: 'red',
    pattern: /\beval\s*\(\s*(?:atob|Buffer\.from|base64|unescape)\b/i,
    why: 'Evaluates a decoded/obfuscated string — the payload is deliberately hidden.',
    appliesTo: 'all',
  },
  {
    category: 'obfuscated-execution',
    severity: 'red',
    pattern: /\|\s*xxd\s+-r[^\n|]*\|\s*(?:sh|bash|zsh)\b/i,
    why: 'Reverses a hex dump into raw bytes and pipes them to a shell.',
    appliesTo: 'all',
  },

  // ---- red: read a secret directly into a network sink ----
  {
    category: 'credential-exfiltration',
    severity: 'red',
    pattern:
      /\b(?:curl|wget)\b[^\n]*(?:-d|--data|--data-binary|-T|--upload-file)[^\n]*(?:\.aws|\.ssh|id_rsa|\.env|\.npmrc|_API_KEY|_SECRET|_TOKEN)/i,
    why: 'Sends the contents of a credentials file or secret env var to a remote server.',
    appliesTo: 'all',
  },
  {
    category: 'credential-exfiltration',
    severity: 'red',
    pattern:
      /\b(?:cat|type|Get-Content)\b[^\n|]*(?:\.aws|\.ssh|id_rsa|\.env|\.npmrc)[^\n|]*\|\s*(?:curl|wget|nc|ncat|base64|xxd)\b/i,
    why: 'Reads a credentials file and pipes it to a network tool — credential exfiltration.',
    appliesTo: 'all',
  },

  // ---- amber: a plain outbound network call ----
  {
    category: 'network-access',
    severity: 'amber',
    pattern:
      /\b(?:curl|wget|nc|ncat|telnet|scp|sftp|Invoke-WebRequest|Invoke-RestMethod)\b|\b(?:fetch|axios|urllib|requests)\.(?:get|post|put|request|urlopen)\b|\brequire\(['"](?:https?|net)['"]\)/i,
    why: 'Makes an outbound network request. Often legitimate, but worth confirming where the data goes.',
    appliesTo: 'all',
  },

  // ---- amber: reads of sensitive paths / secret env vars ----
  {
    category: 'sensitive-path-read',
    severity: 'amber',
    pattern:
      /(?:~|\$HOME|\/home\/[^\s/]+|\/Users\/[^\s/]+)?\/?\.(?:aws|ssh|npmrc|netrc|kube|docker\/config|config\/gh)\b|\bid_rsa\b|\.env(?:\.[a-z]+)?\b/i,
    why: 'References a sensitive credentials path (AWS/SSH/env/etc.).',
    appliesTo: 'all',
  },
  {
    category: 'sensitive-path-read',
    severity: 'amber',
    pattern: /\b[A-Z][A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|ACCESS_KEY|PRIVATE_KEY)[A-Z0-9_]*\b/,
    why: 'Reads a secret-looking environment variable.',
    appliesTo: 'all',
  },

  // ---- amber: dynamic code execution ----
  {
    category: 'dynamic-eval',
    severity: 'amber',
    pattern: /\b(?:eval|exec)\s*\(|\bos\.system\s*\(|\bsubprocess\.(?:call|run|Popen)\b|\bchild_process\b|\bexecSync\s*\(/,
    why: 'Executes dynamically built code or spawns a shell — a common vector for hidden behaviour.',
    appliesTo: 'all',
  },

  // ---- amber: destructive filesystem operations ----
  {
    category: 'destructive-fs',
    severity: 'amber',
    pattern: /\brm\s+-[rf]{1,2}\b|\bRemove-Item\b[^\n]*-Recurse|\brmtree\b|\bshutil\.rmtree\b/i,
    why: 'Recursively deletes files. Verify it only touches paths it created.',
    appliesTo: 'all',
  },

  // ---- amber: prompt-injection phrasing (docs only) ----
  {
    category: 'prompt-injection',
    severity: 'amber',
    pattern:
      /\bignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|context)\b|\bdisregard\s+(?:all\s+)?(?:previous|prior|your|the\s+above)\b/i,
    why: 'Contains "ignore/disregard previous instructions" phrasing — a hallmark of prompt injection.',
    appliesTo: 'doc',
  },
  {
    category: 'prompt-injection',
    severity: 'amber',
    pattern:
      /\b(?:do\s+not|don't|never)\s+(?:tell|inform|mention\s+(?:this\s+)?to|reveal\s+(?:this\s+)?to)\s+the\s+user\b|\bwithout\s+(?:telling|informing|asking)\s+the\s+user\b/i,
    why: 'Instructs the agent to act behind the user’s back — a hallmark of prompt injection.',
    appliesTo: 'doc',
  },
  {
    category: 'prompt-injection',
    severity: 'amber',
    pattern: /\boverride\s+(?:your\s+)?(?:safety|security|system\s+prompt|guardrails?)\b|\bexfiltrat\w*/i,
    why: 'Asks the agent to override its safety rules or exfiltrate data.',
    appliesTo: 'doc',
  },
]
