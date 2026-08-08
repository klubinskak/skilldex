type MetricProps = { label: string; value: string; detail: string; attention?: boolean }

export function Metrics() {
  return <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Workspace statistics"><Metric label="Skills discovered" value="24" detail="Across all sources" /><Metric label="Global skills" value="16" detail="Ready for any project" /><Metric label="Repositories" value="3" detail="1 needs attention" attention /></section>
}

function Metric({ label, value, detail, attention = false }: MetricProps) {
  return <article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{value}</p><p className={`mt-2 text-xs ${attention ? 'text-amber-700' : 'text-slate-400'}`}>{detail}</p></article>
}
