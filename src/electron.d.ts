export {}

import type { SkillFile, WorkspaceConfig, WorkspaceSnapshot } from '@/features/skills/model/skills'

declare global {
  interface Window {
    skilldex: {
      workspace: {
        getConfig(): Promise<WorkspaceConfig>
        getSnapshot(): Promise<WorkspaceSnapshot>
        configureSources(config: WorkspaceConfig): Promise<WorkspaceSnapshot>
        getSkillReadme(id: string): Promise<string | null>
        listSkillFiles(id: string): Promise<SkillFile[] | null>
        revealSkill(id: string): Promise<boolean>
      }
    }
  }
}
