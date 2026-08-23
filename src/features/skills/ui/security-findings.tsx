import { Loader2, ShieldCheck } from 'lucide-react'
import { CATEGORY_LABEL, verdictMeta, type SkillScan, type SkillScanResult } from '../model/skills'

type SecurityFindingsProps = {
  scan: SkillScan | SkillScanResult | null
  loading?: boolean
}

/**
 * The "here's the risky line" panel: the verdict summary followed by each
 * finding as `file:line`, its category, why it was flagged, and the matched
 * source snippet. Shared by the skill detail's Security tab and the pre-install
 * dialog, so it takes a plain scan and renders — no data-fetching of its own.
 */
export function SecurityFindings({ scan, loading }: SecurityFindingsProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[#71717a]">
        <Loader2 className="size-4 animate-spin" /> Scanning for risky patterns…
      </div>
    )
  }
  if (!scan) {
    return <p className="text-[13px] text-[#71717a]">Not scanned yet.</p>
  }

  const meta = verdictMeta(scan.verdict)

  if (scan.findings.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-[#1c3a22] bg-[#0f1f12] px-4 py-3 text-[13px] text-[#4ade80]">
        <ShieldCheck className="size-4 shrink-0" />
        No risky patterns found — nothing piped to a shell, no credential reads, no injection phrasing.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="size-2.5 rounded-full" style={{ background: meta.dot }} />
        <span className="font-semibold text-[#fafafa]">{meta.label}</span>
        <span className="text-[#71717a]">
          — {scan.findings.length} {scan.findings.length === 1 ? 'finding' : 'findings'} to review
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {scan.findings.map((finding, index) => {
          const dot = finding.severity === 'red' ? '#f87171' : '#fbbf24'
          return (
            <div
              key={`${finding.file}:${finding.line}:${finding.category}:${index}`}
              className="overflow-hidden rounded-xl border border-[#1c1c20] bg-[#0c0c0e]"
            >
              <div className="flex items-center gap-2 border-b border-[#1c1c20] bg-[#111114] px-3.5 py-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
                <span className="text-[12.5px] font-semibold text-[#e4e4e7]">
                  {CATEGORY_LABEL[finding.category]}
                </span>
                <span className="ml-auto font-mono text-[11px] text-[#71717a]">
                  {finding.file}
                  {finding.line > 0 ? `:${finding.line}` : ''}
                </span>
              </div>
              <div className="px-3.5 py-2.5">
                <p className="text-[12.5px] leading-relaxed text-[#a1a1aa]">{finding.why}</p>
                {finding.matchedText && (
                  <pre className="mt-2 overflow-x-auto rounded-md border border-[#1c1c20] bg-[#08080a] px-3 py-2 font-mono text-[11.5px] leading-relaxed text-[#d4d4d8]">
                    {finding.matchedText}
                  </pre>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
