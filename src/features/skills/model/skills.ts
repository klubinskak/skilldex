export type Skill = {
  id: string
  name: string
  summary: string
  source: string
  sourceKind: 'Global' | 'Repository' | 'Project'
  projects: string[]
  accent: string
  favourite?: boolean
}

export const skillCatalog: Skill[] = [
  { id: 'codebase-design', name: 'codebase-design', summary: 'Design deep modules with small interfaces and clean seams.', source: '~/.agents/skills', sourceKind: 'Global', projects: ['skilldex', 'paloma'], accent: 'bg-violet-500', favourite: true },
  { id: 'research', name: 'research', summary: 'Research questions against high-trust, primary sources.', source: '~/.agents/skills', sourceKind: 'Global', projects: ['skilldex'], accent: 'bg-amber-500', favourite: true },
  { id: 'shadcn-ui', name: 'shadcn-ui', summary: 'Compose accessible interfaces from reusable UI primitives.', source: 'github.com/shadcn-ui/ui', sourceKind: 'Repository', projects: ['skilldex'], accent: 'bg-slate-700' },
  { id: 'tdd', name: 'tdd', summary: 'Build features through a focused red-green-refactor loop.', source: '~/.agents/skills', sourceKind: 'Global', projects: ['skilldex', 'paloma', 'moss'], accent: 'bg-emerald-500' },
]
