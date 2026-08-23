import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { verdictMeta, type SkillScan, type SkillScanResult } from '../model/skills'

type TrustBadgeProps = {
  /** The scan, or null/undefined while it hasn't been computed yet. */
  scan?: SkillScan | SkillScanResult | null
  /** `pill` for headers and lists; `dot` for the compact card corner. */
  variant?: 'pill' | 'dot'
}

function isReviewed(scan: SkillScan | SkillScanResult): scan is SkillScanResult {
  return 'reviewed' in scan && scan.reviewed
}

/**
 * The red / amber / green safety verdict as a badge. A reviewed skill shows a
 * muted "Reviewed" state instead of its colour; an unscanned skill shows a
 * neutral placeholder until the lazy scan lands.
 */
export function TrustBadge({ scan, variant = 'pill' }: TrustBadgeProps) {
  if (!scan) {
    if (variant === 'dot')
      return <span title="Not scanned yet" className="size-2 shrink-0 rounded-full bg-[#3f3f46]" />
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#27272a] bg-[#18181b] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#71717a]">
        <ShieldQuestion className="size-3" />
        Unscanned
      </span>
    )
  }

  const count = scan.findings.length
  const reviewed = isReviewed(scan)
  const meta = verdictMeta(scan.verdict)

  if (variant === 'dot') {
    const title = reviewed
      ? 'Reviewed by you'
      : `${meta.label}${count ? ` — ${count} finding${count === 1 ? '' : 's'}` : ''}`
    return (
      <span
        title={title}
        className="size-2 shrink-0 rounded-full"
        style={{ background: reviewed ? '#52525b' : meta.dot }}
      />
    )
  }

  if (reviewed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#27272a] bg-[#161616] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
        <ShieldCheck className="size-3" />
        Reviewed
      </span>
    )
  }

  const Icon = scan.verdict === 'green' ? ShieldCheck : ShieldAlert
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${meta.pill}`}
    >
      <Icon className="size-3" />
      {meta.label}
      {count > 0 && <span className="font-mono opacity-70">{count}</span>}
    </span>
  )
}
