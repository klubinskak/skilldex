import { useEffect, useState } from 'react'
import { ArrowLeft, FolderOpen, Loader2, Pencil } from 'lucide-react'
import { scopePillClass, type Skill, type SkillFile } from '../model/skills'
import { SkillToggle } from './skill-toggle'

type SkillDetailProps = {
  skill: Skill
  getReadme: (id: string) => Promise<string | null>
  listFiles: (id: string) => Promise<SkillFile[] | null>
  reveal: (id: string) => Promise<boolean>
  onBack: () => void
}

type Tab = 'instructions' | 'files' | 'activity'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SkillDetail({ skill, getReadme, listFiles, reveal, onBack }: SkillDetailProps) {
  const [tab, setTab] = useState<Tab>('instructions')
  const [readme, setReadme] = useState<string | null>(null)
  const [files, setFiles] = useState<SkillFile[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setReadme(null)
    setFiles(null)
    Promise.all([getReadme(skill.id), listFiles(skill.id)]).then(([md, list]) => {
      if (!active) return
      setReadme(md)
      setFiles(list)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [skill.id, getReadme, listFiles])

  const totalSize = files?.reduce((sum, file) => sum + file.sizeBytes, 0) ?? 0
  const meta: Array<{ label: string; value: string }> = [
    { label: 'Scope', value: skill.scope },
    { label: 'Files', value: String(skill.fileCount) },
    { label: 'Size', value: formatSize(totalSize) },
    { label: 'Symlink', value: skill.isSymlink ? 'yes' : 'no' },
    { label: 'Projects', value: skill.projects.length ? skill.projects.join(', ') : '—' },
  ]

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-5">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-[#71717a] transition hover:text-[#a1a1aa]"
        >
          <ArrowLeft className="size-[15px]" />
          All skills
        </button>

        <div className="flex items-start gap-4">
          <div
            className="grid size-14 shrink-0 place-items-center rounded-[15px] font-mono text-[21px] font-semibold"
            style={{ background: skill.iconBg, color: skill.iconFg }}
          >
            {skill.mono}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-[#fafafa]">{skill.name}</h1>
              <span
                className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${scopePillClass(skill.scope)}`}
              >
                {skill.scope}
              </span>
            </div>
            <p className="mt-1.5 max-w-[620px] text-[14px] leading-relaxed text-[#a1a1aa]">{skill.summary}</p>
          </div>
          <button
            type="button"
            disabled
            title="Editing skills is coming soon"
            className="flex h-9 shrink-0 cursor-not-allowed items-center gap-1.5 rounded-[9px] border border-[#27272a] bg-[#18181b] px-3.5 text-[12.5px] font-medium text-[#e4e4e7] opacity-60"
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
        </div>

        <div className="mt-5 flex gap-2 border-b border-[#1c1c20]">
          {(['instructions', 'files', 'activity'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-1 pb-2.5 text-[13px] capitalize transition ${
                tab === key ? 'border-[#f97316] font-semibold text-[#fafafa]' : 'border-transparent text-[#71717a]'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-[13px] text-[#71717a]">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="mt-5">
            {tab === 'instructions' &&
              (readme ? (
                <div className="overflow-hidden rounded-xl border border-[#1c1c20] bg-[#0c0c0e]">
                  <div className="flex items-center gap-2 border-b border-[#1c1c20] bg-[#111114] px-3.5 py-2.5">
                    <span className="font-mono text-[12px] text-[#a1a1aa]">SKILL.md</span>
                    <span className="ml-auto font-mono text-[11px] text-[#52525b]">markdown</span>
                  </div>
                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap px-4 py-4 font-mono text-[12.5px] leading-relaxed text-[#d4d4d8]">
                    {readme}
                  </pre>
                </div>
              ) : (
                <p className="text-[13px] text-[#71717a]">No SKILL.md content found.</p>
              ))}

            {tab === 'files' &&
              (files && files.length > 0 ? (
                <div className="divide-y divide-[#17171a] overflow-hidden rounded-xl border border-[#1c1c20] bg-[#0c0c0e]">
                  {files.map((file) => (
                    <div key={file.relativePath} className="flex items-center justify-between px-4 py-2.5">
                      <span className="truncate font-mono text-[12.5px] text-[#d4d4d8]">{file.relativePath}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[#52525b]">{formatSize(file.sizeBytes)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[#71717a]">No files found.</p>
              ))}

            {tab === 'activity' && (
              <p className="text-[13px] text-[#71717a]">Usage activity will appear here once tracking lands.</p>
            )}
          </div>
        )}
      </div>

      <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-[#1c1c20] bg-[#0b0b0d] px-5 py-5">
        <div className="mb-4 flex items-center justify-between rounded-[11px] border border-[#232328] bg-[#101013] px-3.5 py-3">
          <div>
            <div className="text-[12px] text-[#71717a]">Status</div>
            <div
              className="mt-0.5 text-[14px] font-semibold"
              style={{ color: skill.enabled ? '#22c55e' : '#a1a1aa' }}
            >
              {skill.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <SkillToggle enabled={skill.enabled} size="lg" />
        </div>

        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#52525b]">Details</div>
        {meta.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 border-b border-[#17171a] py-2.5">
            <span className="text-[12.5px] text-[#71717a]">{row.label}</span>
            <span className="truncate text-right font-mono text-[12.5px] text-[#e4e4e7]">{row.value}</span>
          </div>
        ))}

        <div className="mb-2.5 mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#52525b]">
          Installed at
        </div>
        <div className="break-all rounded-[9px] border border-[#1c1c20] bg-[#0c0c0e] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-[#a1a1aa]">
          {skill.source}
        </div>

        <button
          type="button"
          onClick={() => void reveal(skill.id)}
          className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] border border-[#27272a] bg-[#18181b] text-[12.5px] font-medium text-[#e4e4e7] transition hover:border-[#3a3a42]"
        >
          <FolderOpen className="size-3.5" />
          Reveal in Finder
        </button>
        <button
          type="button"
          disabled
          title="Skill management is coming soon"
          className="mt-2 h-9 w-full cursor-not-allowed rounded-[9px] border border-[#3f2020] bg-transparent text-[12.5px] font-medium text-[#f87171] opacity-60"
        >
          Uninstall
        </button>
      </aside>
    </div>
  )
}
