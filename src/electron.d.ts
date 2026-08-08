export {}

import type {
  CreateSkillInput,
  SkillFile,
  WorkspaceConfig,
  WorkspaceSnapshot,
} from '@/features/skills/model/skills'

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
        pickDirectory(): Promise<string | null>
        enableSkill(id: string): Promise<WorkspaceSnapshot>
        disableSkill(id: string): Promise<WorkspaceSnapshot>
        removeSkill(id: string): Promise<WorkspaceSnapshot>
        createSkill(input: CreateSkillInput): Promise<WorkspaceSnapshot>
      }
    }
  }
}
