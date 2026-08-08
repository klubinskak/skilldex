import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateSkillInput,
  SkillFile,
  WorkspaceConfig,
  WorkspaceSnapshot,
} from '../main/workspace/types'

contextBridge.exposeInMainWorld('skilldex', {
  workspace: {
    getConfig: (): Promise<WorkspaceConfig> => ipcRenderer.invoke('skilldex:get-config'),
    getSnapshot: (): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('skilldex:get-snapshot'),
    configureSources: (config: WorkspaceConfig): Promise<WorkspaceSnapshot> =>
      ipcRenderer.invoke('skilldex:configure-sources', config),
    getSkillReadme: (id: string): Promise<string | null> =>
      ipcRenderer.invoke('skilldex:get-skill-readme', id),
    listSkillFiles: (id: string): Promise<SkillFile[] | null> =>
      ipcRenderer.invoke('skilldex:list-skill-files', id),
    revealSkill: (id: string): Promise<boolean> => ipcRenderer.invoke('skilldex:reveal-skill', id),
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('skilldex:pick-directory'),
    enableSkill: (id: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('skilldex:enable-skill', id),
    disableSkill: (id: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('skilldex:disable-skill', id),
    removeSkill: (id: string): Promise<WorkspaceSnapshot> => ipcRenderer.invoke('skilldex:remove-skill', id),
    createSkill: (input: CreateSkillInput): Promise<WorkspaceSnapshot> =>
      ipcRenderer.invoke('skilldex:create-skill', input),
  },
})
